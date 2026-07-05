import os
import sys
import re
import json
import hashlib
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
from openai import OpenAI

# Add current path to sys.path
sys.path.append(os.path.dirname(__file__))
from okf_utils import slugify, init_okf_dir, append_to_index, append_to_log
from contradiction import check_contradiction, find_pairs_to_check

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

async def check_contradiction_async(client: OpenAI, model: str, ent_a: Dict[str, Any], ent_b: Dict[str, Any], semaphore: asyncio.Semaphore) -> Dict[str, Any]:
    async with semaphore:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, check_contradiction, client, model, ent_a, ent_b
        )

async def run_contradiction_checks(client: OpenAI, model: str, pairs: List[Tuple[Dict[str, Any], Dict[str, Any]]]) -> List[Dict[str, Any]]:
    semaphore = asyncio.Semaphore(5)  # Max 5 concurrent calls to OpenAI
    tasks = [
        check_contradiction_async(client, model, a, b, semaphore)
        for a, b in pairs
    ]
    return await asyncio.gather(*tasks)

def main():
    load_dotenv()
    entities_dir = "results_entities"
    kg_dir = "knowledge_graph"
    
    os.makedirs(kg_dir, exist_ok=True)
    
    # Initialize all directories
    for sub in DIR_MAP.values():
        init_okf_dir(os.path.join(kg_dir, sub))
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
    file_map: Dict[str, str] = {}
    
    json_files = [f for f in os.listdir(entities_dir) if f.endswith(".json")]
    
    for filename in sorted(json_files):
        with open(os.path.join(entities_dir, filename), "r", encoding="utf-8") as f:
            data = json.load(f)
            
        source_doc = filename.replace(".txt.json", "")
        resource_path = f"test_documents/{source_doc}"
        
        for ent in data.get("entities", []):
            ent["resource"] = resource_path
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
        
        body_links = []
        for link in ent.get("linked_concepts", []):
            if link.lower() in file_map:
                target_path = file_map[link.lower()]
                target_folder, target_file = target_path.split("/")
                if target_folder == sub_dir:
                    rel_link = f"./{target_file}"
                else:
                    rel_link = f"../{target_path}"
                body_links.append(f"- [{link}]({rel_link})")
                
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
            
        dir_full_path = os.path.join(kg_dir, sub_dir)
        append_to_index(dir_full_path, filename, title, description)
        append_to_log(dir_full_path, "INGEST", f"Ingested entity {title} from source {resource}")
        append_to_log(kg_dir, "INGEST", f"Ingested entity {title} into category {sub_dir}")

    # 2.5 Parse written OKF files to collect markdown-link-based pairs (Audit requirement)
    for ent in all_entities:
        file_path = os.path.join(kg_dir, ent["rel_path"])
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            matches = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
            for label, target in matches:
                if target.startswith(".") or target.startswith(".."):
                    if label.lower() not in [lc.lower() for lc in ent.get("linked_concepts", [])]:
                        ent.setdefault("linked_concepts", []).append(label)

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
    
    pairs_to_check = find_pairs_to_check(all_entities, file_map)
    logger.info(f"Identified {len(pairs_to_check)} candidate pairs for contradiction audit.")
    
    # Run async checks in parallel
    results = asyncio.run(run_contradiction_checks(client, model, pairs_to_check))
    
    for (ent, target_ent), res in zip(pairs_to_check, results):
        if res.get("contradiction_detected") and res.get("confidence_score", 0) > 0.7:
            contradiction_count += 1
            conf_score = res.get("confidence_score")
            severity = res.get("severity", "medium")
            explanation = res.get("explanation", "No explanation provided")
            
            logger.warning(f"[CONTRADICTION DETECTED] Severity: {severity}, Confidence: {conf_score}")
            
            hash_input = f"{ent['name']}-{target_ent['name']}".encode("utf-8")
            conflict_hash = hashlib.md5(hash_input).hexdigest()[:8]
            alert_filename = f"conflict-{conflict_hash}.md"
            alert_rel_path = f"alerts/{alert_filename}"
            
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
                
            alert_title = f"Conflict: {ent['name']} and {target_ent['name']}"
            append_to_index(os.path.join(kg_dir, "alerts"), alert_filename, alert_title, explanation)
            append_to_log(os.path.join(kg_dir, "alerts"), "ALERT", f"Detected contradiction between {ent['name']} and {target_ent['name']}")
            append_to_log(kg_dir, "ALERT", f"Contradiction alert created: {alert_filename}")
            
    logger.info(f"Graph construction and safety audit complete. Found {contradiction_count} contradictions.")

if __name__ == "__main__":
    main()
