import re
import json
import logging
from collections import defaultdict
from typing import List, Dict, Any, Tuple
from openai import OpenAI
from okf_utils import slugify

logger = logging.getLogger("vigil.build_graph")


def check_contradiction(
    client: OpenAI, model: str, ent_a: Dict[str, Any], ent_b: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Queries LLM to check if two entities contradict or conflict on safety-critical parameters or rules.
    """
    system_prompt = (
        "You are a safety-critical industrial compliance auditor. Compare the contents of these two industrial entities "
        "and determine if they contradict, conflict, or present safety/regulatory violations when combined.\n\n"
        "A genuine contradiction is defined as:\n"
        "1. Conflicting safety limits, parameters, or numeric thresholds (e.g., a regulation states max pressure is 100 PSI, "
        "but a procedure or equipment specification permits 120 PSI).\n"
        "2. Incompatible required actions or procedures (e.g., one document instructs to bypass an interlock, while "
        "another safety rule strictly prohibits manual bypasses).\n"
        "3. Out-of-spec or overdue critical status (e.g., a regulation requires weekly calibration, but a maintenance log "
        "shows the last service was 6 months ago).\n\n"
        "Only flag a contradiction if you can quote the exact conflicting statement from each source. "
        "If either side requires inferring an unstated requirement, return contradiction_detected: false.\n\n"
        "IMPORTANT: DO NOT flag naming discrepancies, spelling differences, title variations, or entity deduplication issues "
        "as contradictions. These are data-alignment details, not compliance or safety conflicts. Only flag genuine "
        "operational, procedural, or regulatory contradictions.\n\n"
        "Return a valid JSON object matching this schema exactly:\n"
        "{\n"
        '  "contradiction_detected": true | false,\n'
        '  "confidence_score": 0.0 to 1.0,\n'
        '  "severity": "low" | "medium" | "high" | "critical",\n'
        '  "explanation": "Detailed explanation of the contradiction, specifying what numbers, rules, or parameters conflict and what must be resolved, otherwise empty string"\n'
        "}\n\n"
        "Do not return any explanations or markdown block wrappers. Return pure raw JSON."
    )

    user_prompt = (
        f"Entity A:\n"
        f"Title: {ent_a['name']}\n"
        f"Type: {ent_a['type']}\n"
        f"Description: {ent_a['description']}\n\n"
        f"Entity B:\n"
        f"Title: {ent_b['name']}\n"
        f"Type: {ent_b['type']}\n"
        f"Description: {ent_b['description']}\n"
    )

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
        )
        content = completion.choices[0].message.content.strip()
        # Clean markdown codeblocks
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        return json.loads(content)
    except Exception as e:
        logger.warning(
            f"Contradiction check failed between {ent_a['name']} and {ent_b['name']}: {str(e)}"
        )
        return {
            "contradiction_detected": False,
            "confidence_score": 0.0,
            "severity": "low",
            "explanation": "",
        }


def find_pairs_to_check(
    all_entities: List[Dict[str, Any]], file_map: Dict[str, str]
) -> List[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """
    Finds candidates for contradiction checks across regulation, procedure, and maintenance directories.
    Optimized with lookup indices to avoid nested O(N^2) iterations.
    """
    by_tag = defaultdict(list)
    by_ref = defaultdict(list)
    by_type = defaultdict(list)

    def normalize_ref(ref: str) -> str:
        return re.sub(r"[^a-z0-9]", "", ref.lower())

    for ent in all_entities:
        for tag in ent.get("equipment_tags", []):
            by_tag[tag].append(ent)
        for ref in ent.get("regulatory_references", []):
            normalized = normalize_ref(ref)
            if len(normalized) > 2:
                by_ref[normalized].append(ent)
        by_type[ent["type"]].append(ent)

    pairs = []
    seen = set()

    def get_slug_words(name: str) -> set:
        return set(slugify(name).split("-"))

    ent_by_name_lower = {ent["name"].lower(): ent for ent in all_entities}

    for ent_a in all_entities:
        candidates = set()

        # 1. Explicit Link Match
        for link_name in ent_a.get("linked_concepts", []):
            if link_name.lower() in file_map:
                candidates.add(link_name.lower())

        # 2. Shared Equipment Tag Match
        for tag in ent_a.get("equipment_tags", []):
            for other in by_tag[tag]:
                if other["name"] != ent_a["name"]:
                    candidates.add(other["name"].lower())

        # 3. Shared Regulatory Reference Match
        for ref in ent_a.get("regulatory_references", []):
            normalized = normalize_ref(ref)
            if len(normalized) > 2:
                for other in by_ref[normalized]:
                    if other["name"] != ent_a["name"]:
                        candidates.add(other["name"].lower())

        # 4. Cross-type Keyword Match (Regulations vs Procedures/Logs)
        if ent_a["type"] == "regulation":
            words_a = get_slug_words(ent_a["name"])
            for other_type in ["procedure", "maintenance_log"]:
                for other in by_type[other_type]:
                    words_b = get_slug_words(other["name"])
                    common = words_a & words_b - {
                        "and",
                        "of",
                        "the",
                        "or",
                        "to",
                        "for",
                        "a",
                        "an",
                        "in",
                        "on",
                        "at",
                        "by",
                        "with",
                    }
                    if common:
                        candidates.add(other["name"].lower())
        elif ent_a["type"] in ["procedure", "maintenance_log"]:
            words_a = get_slug_words(ent_a["name"])
            for other in by_type["regulation"]:
                words_b = get_slug_words(other["name"])
                common = words_a & words_b - {
                    "and",
                    "of",
                    "the",
                    "or",
                    "to",
                    "for",
                    "a",
                    "an",
                    "in",
                    "on",
                    "at",
                    "by",
                    "with",
                }
                if common:
                    candidates.add(other["name"].lower())

        # 5. Abbreviation or Substring Name Match
        slug_a = slugify(ent_a["name"])
        if len(slug_a) > 2:
            for ent_b in all_entities:
                if ent_b["name"] != ent_a["name"]:
                    slug_b = slugify(ent_b["name"])
                    if len(slug_b) > 2 and (slug_a in slug_b or slug_b in slug_a):
                        candidates.add(ent_b["name"].lower())

        # Save unique pairs
        for cand_name in candidates:
            other = ent_by_name_lower.get(cand_name)
            if other:
                pair_key = tuple(sorted([ent_a["name"], other["name"]]))
                if pair_key not in seen:
                    pairs.append((ent_a, other))
                    seen.add(pair_key)

    return pairs
