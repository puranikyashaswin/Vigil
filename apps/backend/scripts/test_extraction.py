import os
import sys
import time
import json
import argparse
import logging
from typing import List, Tuple
from pydantic import BaseModel, Field, ValidationError
from dotenv import load_dotenv
from openai import OpenAI
from portkey_ai import PORTKEY_GATEWAY_URL, createHeaders

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.test_extraction")

# 1. Define Pydantic schema matching ingest-document.md
class ExtractedEntity(BaseModel):
    name: str = Field(description="Formal name of the entity, e.g., 'High-Pressure Valve V-202'")
    type: str = Field(description="Must be one of: concept, procedure, regulation, maintenance_log, drawing")
    description: str = Field(description="Summary of the entity's purpose, parameters, or specifications")
    equipment_tags: List[str] = Field(default=[], description="List of standard equipment IDs, e.g., ['V-202', 'P-101']")
    regulatory_references: List[str] = Field(default=[], description="List of referenced standards, e.g., ['OSHA 1910.119']")
    linked_concepts: List[str] = Field(default=[], description="Titles/names of other entities mentioned in this text to create markdown links to")
    tags: List[str] = Field(default=[], description="Descriptive classification tags")

class ExtractedEntitiesList(BaseModel):
    entities: List[ExtractedEntity]

def get_portkey_client() -> Tuple[OpenAI, str]:
    """
    Initializes OpenAI client. Routes through OpenRouter if Groq/Portkey keys are placeholders.
    Returns (client, model_slug).
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    
    # Check for placeholders
    is_groq_placeholder = not groq_api_key or "your_" in groq_api_key
    is_portkey_placeholder = not portkey_api_key or "your_" in portkey_api_key
    
    if (is_groq_placeholder or is_portkey_placeholder) and openrouter_api_key and "your_" not in openrouter_api_key:
        logger.info("Using OpenRouter endpoint for entity extraction (Portkey/Groq keys are placeholders).")
        client = OpenAI(
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        return client, "meta-llama/llama-3.3-70b-instruct"
        
    if not groq_api_key or not portkey_api_key:
        raise Exception("Missing GROQ_API_KEY or PORTKEY_API_KEY in environment.")
        
    client = OpenAI(
        api_key=groq_api_key,
        base_url=PORTKEY_GATEWAY_URL,
        default_headers=createHeaders(
            provider="groq",
            api_key=portkey_api_key
        )
    )
    return client, "llama-3.3-70b-versatile"

def extract_entities_llm(client: OpenAI, model: str, text: str, self_repair_error: str = None) -> str:
    """
    Calls the LLM to extract entities in JSON format.
    If self_repair_error is provided, appends it as instruction.
    """
    system_prompt = (
        "You are an expert industrial knowledge parser. Analyze the raw text and extract all primary entities. "
        "Return a valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"entities\": [\n"
        "    {\n"
        "      \"name\": \"Formal name of the entity\",\n"
        "      \"type\": \"concept\" | \"procedure\" | \"regulation\" | \"maintenance_log\" | \"drawing\",\n"
        "      \"description\": \"Summary of the entity's purpose, parameters, or specifications\",\n"
        "      \"equipment_tags\": [\"list of standard equipment ID tags present in the raw text, otherwise []\"],\n"
        "      \"regulatory_references\": [\"list of regulatory standard references present in the raw text, otherwise []\"],\n"
        "      \"linked_concepts\": [\"Titles/names of other entities mentioned in this text to create markdown links to\"],\n"
        "      \"tags\": [\"descriptive classification tags\"]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Strict Grounding Rules:\n"
        "1. DO NOT extract or include any equipment tags, regulatory references, or linked concepts unless they are LITERALLY mentioned in the provided raw text.\n"
        "2. DO NOT use example values (like 'V-202' or 'P-101') unless they are explicitly present in the input text.\n"
        "3. If no tags or references are found, return empty lists [].\n"
        "4. Return pure raw JSON without any explanations or markdown block wrappers."
    )
    
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    if self_repair_error:
        messages.append({"role": "user", "content": f"Here is the raw text:\n---\n{text}\n---\n"})
        messages.append({"role": "assistant", "content": "I apologize, let me fix the formatting."})
        messages.append({"role": "user", "content": f"The previous extraction failed validation with error:\n{self_repair_error}\n\nPlease output the corrected, complete, and valid JSON matching the schema."})
    else:
        messages.append({"role": "user", "content": f"Raw text to analyze:\n---\n{text}\n---\n"})
        
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.0
    )
    
    return completion.choices[0].message.content

def run_extraction_flow(client: OpenAI, model: str, text: str, fallback_title: str) -> ExtractedEntitiesList:
    """
    Executes the extraction and runs self-repair loop if validation fails.
    """
    raw_json = ""
    try:
        raw_json = extract_entities_llm(client, model, text)
        # Attempt to clean up JSON blocks if the model wrapped it in ```json ... ```
        raw_json = clean_json_string(raw_json)
        return ExtractedEntitiesList.model_validate_json(raw_json)
    except Exception as e:
        logger.warning(f"Initial validation failed: {str(e)}. Attempting self-repair on JSON...")
        try:
            # Self-repair iteration
            raw_json = extract_entities_llm(client, model, text, self_repair_error=str(e))
            raw_json = clean_json_string(raw_json)
            return ExtractedEntitiesList.model_validate_json(raw_json)
        except Exception as e_repair:
            logger.error(f"Self-repair validation failed: {str(e_repair)}. Applying generic fallback.")
            # Standard generic fallback
            fallback_entity = ExtractedEntity(
                name=fallback_title,
                type="concept",
                description=text[:2000] + ("..." if len(text) > 2000 else ""),
                tags=["fallback", "unparsed"]
            )
            return ExtractedEntitiesList(entities=[fallback_entity])

def clean_json_string(s: str) -> str:
    """
    Cleans raw markdown block wrappers from JSON string.
    """
    s = s.strip()
    if s.startswith("```"):
        # Remove first line
        lines = s.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s

def parse_args():
    parser = argparse.ArgumentParser(description="Vigil Entity Extraction Test Suite")
    parser.add_argument(
        "--input-dir",
        default="results",
        help="Path to directory containing parsed text files"
    )
    parser.add_argument(
        "--output-dir",
        default="results_entities",
        help="Path to directory where extracted entities will be written"
    )
    return parser.parse_args()

def main():
    load_dotenv()
    args = parse_args()
    input_dir = args.input_dir
    output_dir = args.output_dir
    
    if not os.path.exists(input_dir):
        logger.error(f"Input directory does not exist: {input_dir}")
        sys.exit(1)
        
    os.makedirs(output_dir, exist_ok=True)
    
    # Get all parsed text files
    files = [f for f in os.listdir(input_dir) if f.endswith(".txt") and os.path.isfile(os.path.join(input_dir, f))]
    
    if not files:
        logger.warning(f"No parsed text files found in {input_dir}")
        sys.exit(0)
        
    logger.info(f"Initializing LLM client...")
    try:
        client, model = get_portkey_client()
        logger.info(f"Using model: {model}")
    except Exception as e:
        logger.error(f"Failed to initialize client: {str(e)}")
        sys.exit(1)
        
    logger.info(f"Starting entity extraction on {len(files)} files...")
    results = []
    
    for filename in sorted(files):
        file_path = os.path.join(input_dir, filename)
        logger.info(f"--- Extracting from: {filename} ---")
        
        start_time = time.time()
        status = "FAIL"
        error_msg = ""
        entities_count = 0
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
                
            if not text.strip():
                raise Exception("Input file is empty")
                
            # Fallback title is file basename without extension
            fallback_title = os.path.splitext(os.path.splitext(filename)[0])[0]
            
            entities_list = run_extraction_flow(client, model, text, fallback_title)
            entities_count = len(entities_list.entities)
            
            # Write to output folder
            output_file = os.path.join(output_dir, f"{filename}.json")
            with open(output_file, "w", encoding="utf-8") as out_f:
                out_f.write(entities_list.model_dump_json(indent=2))
                
            status = "PASS"
            logger.info(f"Successfully extracted {entities_count} entities from {filename}")
            
        except Exception as e:
            status = "FAIL"
            error_msg = str(e)
            logger.error(f"Extraction failed for {filename}: {error_msg}")
            
        elapsed = time.time() - start_time
        logger.info(f"Completed in {elapsed:.2f}s\n")
        
        results.append({
            "file": filename,
            "status": status,
            "entities": entities_count,
            "time": elapsed,
            "error": error_msg
        })
        
    # Print execution summary table
    print("\n" + "="*80)
    print("ENTITY EXTRACTION PROCESS SUMMARY")
    print("="*80)
    print(f"{'File Name':<40} | {'Status':<6} | {'Entities':<8} | {'Time (s)':<8} | {'Details / Error':<20}")
    print("-"*100)
    for res in results:
        details = "" if res["status"] == "PASS" else res["error"]
        if len(details) > 30:
            details = details[:27] + "..."
        print(f"{res['file'][:40]:<40} | {res['status']:<6} | {res['entities']:<8} | {res['time']:<8.2f} | {details}")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
