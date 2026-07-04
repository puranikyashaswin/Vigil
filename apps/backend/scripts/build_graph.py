import os
import sys
import re
import json
import time
import hashlib
import logging
import unicodedata
from datetime import datetime
from typing import List, Dict, Any, Tuple
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from openai import OpenAI

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.build_graph")

# Directory mappings
DIR_MAP = {
    "concept": "equipment",
    "drawing": "equipment",
    "procedure": "procedures",
    "regulation": "regulations",
    "maintenance_log": "maintenance",
    "alert": "alerts"
}

def slugify(text: str) -> str:
    """
    Converts string to lowercase url-friendly slug.
    """
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('utf-8')
    text = text.lower()
    text = re.sub(r'[^a-z0-9\-]', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def get_client() -> Tuple[OpenAI, str]:
    """
    Initializes OpenAI client routed through OpenRouter or Portkey.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    
    is_groq_placeholder = not groq_api_key or "your_" in groq_api_key
    is_portkey_placeholder = not portkey_api_key or "your_" in portkey_api_key
    
    if (is_groq_placeholder or is_portkey_placeholder) and openrouter_api_key and "your_" not in openrouter_api_key:
        client = OpenAI(
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        return client, "meta-llama/llama-3.3-70b-instruct"
        
    client = OpenAI(
        api_key=groq_api_key,
        base_url="https://api.portkey.ai/v1",
        default_headers={
            "x-portkey-provider": "groq",
            "x-portkey-api-key": portkey_api_key
        }
    )
    return client, "llama-3.3-70b-versatile"

def check_contradiction(client: OpenAI, model: str, ent_a: Dict[str, Any], ent_b: Dict[str, Any]) -> Dict[str, Any]:
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
        "  \"contradiction_detected\": true | false,\n"
        "  \"confidence_score\": 0.0 to 1.0,\n"
        "  \"severity\": \"low\" | \"medium\" | \"high\" | \"critical\",\n"
        "  \"explanation\": \"Detailed explanation of the contradiction, specifying what numbers, rules, or parameters conflict and what must be resolved, otherwise empty string\"\n"
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
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.0
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
        logger.warning(f"Contradiction check failed between {ent_a['name']} and {ent_b['name']}: {str(e)}")
        return {"contradiction_detected": False, "confidence_score": 0.0, "severity": "low", "explanation": ""}

def find_pairs_to_check(all_entities: List[Dict[str, Any]], file_map: Dict[str, str]) -> List[Tuple[Dict[str, Any], Dict[str, Any]]]:
    """
    Finds candidates for contradiction checks across regulation, procedure, and maintenance directories.
    """
    pairs = []
    seen = set()
    
    def get_slug_words(name: str) -> set:
        return set(slugify(name).split("-"))
        
    for i, ent_a in enumerate(all_entities):
        for j, ent_b in enumerate(all_entities):
            if i >= j:
                continue
                
            pair_key = tuple(sorted([ent_a["name"], ent_b["name"]]))
            if pair_key in seen:
                continue
                
            should_check = False
            
            # Explicit Link Match
            linked_a = [l.lower() for l in ent_a.get("linked_concepts", [])]
            linked_b = [l.lower() for l in ent_b.get("linked_concepts", [])]
            if ent_b["name"].lower() in linked_a or ent_a["name"].lower() in linked_b:
                should_check = True
                
            # Abbreviation or Substring Name Match
            slug_a = slugify(ent_a["name"])
            slug_b = slugify(ent_b["name"])
            if (len(slug_a) > 2 and len(slug_b) > 2) and (slug_a in slug_b or slug_b in slug_a):
                should_check = True
                
            # Shared Equipment Tag Match
            tags_a = set(ent_a.get("equipment_tags", []))
            tags_b = set(ent_b.get("equipment_tags", []))
            if tags_a & tags_b:
                should_check = True
                
            # Shared Regulatory Reference Match
            def normalize_ref(ref: str) -> str:
                return re.sub(r'[^a-z0-9]', '', ref.lower())
            refs_a = {normalize_ref(r) for r in ent_a.get("regulatory_references", []) if len(r) > 2}
            refs_b = {normalize_ref(r) for r in ent_b.get("regulatory_references", []) if len(r) > 2}
            if refs_a & refs_b:
                should_check = True
                
            # Cross-type Keyword Match (Regulations vs Procedures/Logs)
            if (ent_a["type"] == "regulation" and ent_b["type"] in ["procedure", "maintenance_log"]) or \
               (ent_b["type"] == "regulation" and ent_a["type"] in ["procedure", "maintenance_log"]):
                words_a = get_slug_words(ent_a["name"])
                words_b = get_slug_words(ent_b["name"])
                common = words_a & words_b - {"and", "of", "the", "or", "to", "for", "a", "an", "in", "on", "at", "by", "with"}
                if common:
                    should_check = True
                    
            if should_check:
                pairs.append((ent_a, ent_b))
                seen.add(pair_key)
                
    return pairs

def init_okf_dir(dir_path: str):
    """
    Initializes a subdirectory with index.md and log.md if they do not exist.
    """
    os.makedirs(dir_path, exist_ok=True)
    index_path = os.path.join(dir_path, "index.md")
    log_path = os.path.join(dir_path, "log.md")
    
    dir_name = os.path.basename(dir_path.rstrip("/"))
    
    if not os.path.exists(index_path):
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(f"# Index: {dir_name.capitalize()}\n\nList of all active concepts inside the {dir_name} category:\n\n")
            
    if not os.path.exists(log_path):
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"# Log: {dir_name.capitalize()} Audit Trail\n\nRecord of ingest, link, and modification actions:\n\n")

def append_to_index(dir_path: str, filename: str, title: str, desc: str):
    """
    Appends a new file reference to the index.md.
    """
    index_path = os.path.join(dir_path, "index.md")
    
    # Read current index to prevent duplicates
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    link_line = f"- [{title}](./{filename}): {desc[:120]}..."
    if link_line not in content and filename not in content:
        with open(index_path, "a", encoding="utf-8") as f:
            f.write(f"{link_line}\n")

def append_to_log(dir_path: str, action: str, msg: str):
    """
    Appends an audit log entry to log.md.
    """
    log_path = os.path.join(dir_path, "log.md")
    date_str = datetime.now().strftime("%Y-%m-%d")
    timestamp_str = datetime.now().isoformat()
    
    entry = f"\n### {date_str}\n**{action}**: {msg} ({timestamp_str})\n"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(entry)

def main():
    load_dotenv()
    entities_dir = "results_entities"
    kg_dir = "knowledge_graph"
    
    os.makedirs(kg_dir, exist_ok=True)
    
    # Initialize all directories
    for sub in DIR_MAP.values():
        init_okf_dir(os.path.join(kg_dir, sub))
    # alerts is always needed
    init_okf_dir(os.path.join(kg_dir, "alerts"))
    
    # Root indexes/logs
    if not os.path.exists(os.path.join(kg_dir, "index.md")):
        with open(os.path.join(kg_dir, "index.md"), "w", encoding="utf-8") as f:
            f.write("# Vigil Knowledge Graph Index\n\nWelcome to the OKF Knowledge Bundle. Concept categories:\n\n"
                    "- [Equipment & Concepts](./equipment/index.md)\n"
                    "- [Procedures](./procedures/index.md)\n"
                    "- [Regulations](./regulations/index.md)\n"
                    "- [Maintenance History](./maintenance/index.md)\n"
                    "- [Contradiction Alerts](./alerts/index.md)\n")
    if not os.path.exists(os.path.join(kg_dir, "log.md")):
        with open(os.path.join(kg_dir, "log.md"), "w", encoding="utf-8") as f:
            f.write("# Vigil Global Ingestion Log\n\nGlobal audit trail of pipeline runs:\n\n")

    # 1. Load all entities
    all_entities: List[Dict[str, Any]] = []
    file_map: Dict[str, str] = {} # Entity Name -> Relative file path in KG
    
    # Resolve all files in results_entities
    json_files = [f for f in os.listdir(entities_dir) if f.endswith(".json")]
    
    for filename in sorted(json_files):
        with open(os.path.join(entities_dir, filename), "r", encoding="utf-8") as f:
            data = json.load(f)
            
        source_doc = filename.replace(".txt.json", "")
        # Map back to test_documents/ path
        resource_path = f"test_documents/{source_doc}"
        
        for ent in data.get("entities", []):
            ent["resource"] = resource_path
            # Slugify file path
            slug = slugify(ent["name"])
            sub_dir = DIR_MAP.get(ent["type"], "equipment")
            rel_path = f"{sub_dir}/{slug}.md"
            
            ent["rel_path"] = rel_path
            ent["filename"] = f"{slug}.md"
            ent["sub_dir"] = sub_dir
            
            all_entities.append(ent)
            file_map[ent["name"].lower()] = rel_path

    # 2. Write OKF markdown files
    logger.info(f"Writing {len(all_entities)} entities to knowledge_graph/")
    for ent in all_entities:
        title = ent["name"]
        description = ent["description"]
        resource = ent["resource"]
        ent_type = ent["type"]
        sub_dir = ent["sub_dir"]
        filename = ent["filename"]
        tags = ent.get("tags", [])
        
        # Build relative paths for links
        body_links = []
        for link in ent.get("linked_concepts", []):
            if link.lower() in file_map:
                target_path = file_map[link.lower()]
                # link is in a sibling directory or same directory. Calculate relative link path:
                # e.g., if current is regulations/osha.md, and target is procedures/crude-feed-startup.md, path is ../procedures/crude-feed-startup.md
                # Since we always structure one directory deep:
                target_folder, target_file = target_path.split("/")
                if target_folder == sub_dir:
                    rel_link = f"./{target_file}"
                else:
                    rel_link = f"../{target_path}"
                body_links.append(f"- [{link}]({rel_link})")
                
        # Markdown body
        body_lines = [
            f"---\ntype: {ent_type}",
            f"title: \"{title}\"",
            f"description: \"{description}\"",
            f"resource: \"{resource}\"",
            f"tags: {tags}",
            f"timestamp: {datetime.now().isoformat()}",
            "---\n",
            f"# {title}\n",
            description,
            "\n## References & Links"
        ]
        
        if body_links:
            body_lines.append("\n".join(body_links))
        else:
            body_lines.append("No links established.")
            
        full_path = os.path.join(kg_dir, ent["rel_path"])
        with open(full_path, "w", encoding="utf-8") as f:
            f.write("\n".join(body_lines) + "\n")
            
        # Update indexes and logs
        dir_full_path = os.path.join(kg_dir, sub_dir)
        append_to_index(dir_full_path, filename, title, description)
        append_to_log(dir_full_path, "INGEST", f"Ingested entity {title} from source {resource}")
        append_to_log(kg_dir, "INGEST", f"Ingested entity {title} into category {sub_dir}")

    # 3. Contradiction Detection Step
    logger.info("Initializing LLM for contradiction checks...")
    try:
        client, model = get_client()
        logger.info(f"Using client model: {model}")
    except Exception as e:
        logger.error(f"Failed to initialize client: {str(e)}")
        sys.exit(1)
        
    logger.info("Running pairwise contradiction detection on candidate safety intersections...")
    contradiction_count = 0
    
    # Identify pairs to check using the new smart matcher
    pairs_to_check = find_pairs_to_check(all_entities, file_map)
    logger.info(f"Identified {len(pairs_to_check)} candidate pairs for contradiction audit.")
    
    for ent, target_ent in pairs_to_check:
        logger.info(f"Auditing safety and compliance: {ent['name']} <---> {target_ent['name']}")
        res = check_contradiction(client, model, ent, target_ent)
        
        if res.get("contradiction_detected") and res.get("confidence_score", 0) > 0.7:
            contradiction_count += 1
            conf_score = res.get("confidence_score")
            severity = res.get("severity", "medium")
            explanation = res.get("explanation", "No explanation provided")
            
            logger.warning(f"[CONTRADICTION DETECTED] Severity: {severity}, Confidence: {conf_score}")
            
            # Generate conflict alert file
            hash_input = f"{ent['name']}-{target_ent['name']}".encode("utf-8")
            conflict_hash = hashlib.md5(hash_input).hexdigest()[:8]
            alert_filename = f"conflict-{conflict_hash}.md"
            alert_rel_path = f"alerts/{alert_filename}"
            
            # Build relative links back
            ent_folder, ent_file = ent["rel_path"].split("/")
            target_folder, target_file = target_ent["rel_path"].split("/")
            
            alert_content = [
                "---",
                "type: alert",
                f"title: \"Conflict: {ent['name']} and {target_ent['name']}\"",
                f"description: \"{explanation[:150]}...\"",
                "resource: \"pipeline/session-contradiction\"",
                f"tags: [conflict, alert, {severity}]",
                f"timestamp: {datetime.now().isoformat()}",
                f"confidence_score: {conf_score}",
                f"severity: {severity}",
                "---\n",
                f"# Alert: Compliance Conflict Detected\n",
                f"A contradiction has been flagged between two linked concepts.\n",
                f"## Conflict Details",
                f"- **Conflicting Source A**: [{ent['name']}](../{ent_folder}/{ent_file})",
                f"- **Conflicting Source B**: [{target_ent['name']}](../{target_folder}/{target_file})",
                f"\n## Audit Findings",
                explanation,
                f"\n## Recommended Actions",
                "1. Verify both files and reconcile the differences.",
                "2. Halt procedures referencing incorrect parameters."
            ]
            
            with open(os.path.join(kg_dir, alert_rel_path), "w", encoding="utf-8") as out_f:
                out_f.write("\n".join(alert_content) + "\n")
                
            # Update alerts directory
            alert_title = f"Conflict: {ent['name']} and {target_ent['name']}"
            append_to_index(os.path.join(kg_dir, "alerts"), alert_filename, alert_title, explanation)
            append_to_log(os.path.join(kg_dir, "alerts"), "ALERT", f"Detected contradiction between {ent['name']} and {target_ent['name']}")
            append_to_log(kg_dir, "ALERT", f"Contradiction alert created: {alert_filename}")
            
    logger.info(f"Graph construction and safety audit complete. Found {contradiction_count} contradictions.")

if __name__ == "__main__":
    main()
