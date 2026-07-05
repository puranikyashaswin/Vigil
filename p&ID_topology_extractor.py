import os
import sys
import base64
import json
import logging
import argparse
from typing import List, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.topology_extractor")

# 1. Define Pydantic Schema matching required structure
class ExtractedNode(BaseModel):
    id: str = Field(description="Strict alphanumeric tag identifier of the equipment, e.g., P-101, V-202, T-300")
    type: str = Field(description="Equipment category. Must be one of: pump, valve, tank, vessel, column, indicator, instrument")
    description: str = Field(description="Details, labels, or specifications printed near the equipment tag in the diagram")

class ExtractedEdge(BaseModel):
    source: str = Field(description="Tag ID of the source equipment node where the pipe/signal starts")
    target: str = Field(description="Tag ID of the target equipment node where the pipe/signal ends")
    relation: str = Field(description="Must be one of: discharges_to, feeds, monitors, bypasses, vents_to")

class TopologyGraph(BaseModel):
    nodes: List[ExtractedNode] = Field(description="List of all unique equipment and instrumentation nodes detected in the P&ID")
    edges: List[ExtractedEdge] = Field(description="List of piping connections or signal paths between the detected nodes")

def encode_image(image_path: str) -> str:
    """
    Reads an image file and converts it to a base64 encoded string.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"P&ID image file not found: {image_path}")
    with open(image_path, "rb") as img_file:
        return base64.b64encode(img_file.read()).decode("utf-8")

def clean_json_response(raw_response: str) -> str:
    """
    Strips markdown codeblock wrappers from the LLM response text.
    """
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    retry=retry_if_exception_type((json.JSONDecodeError, ValueError, Exception)),
    reraise=True
)
def fetch_topology_from_llm(client: OpenAI, model_slug: str, image_b64: str) -> TopologyGraph:
    """
    Dispatches image and system instructions to OpenRouter and validates output against Pydantic schema.
    Includes tenacity retry handling on JSON or parsing failures.
    """
    system_prompt = (
        "You are an expert industrial instrumentation and piping systems designer.\n"
        "Your task is to analyze the process and instrumentation diagram (P&ID) and trace the operational connectivity.\n\n"
        "Instructions:\n"
        "1. Identify all equipment and instrumentation tag nodes. Extract their ID tags (e.g., P-101, V-202, T-300), "
        "their category (pump, valve, tank, vessel, column, indicator, instrument), and any specification notes nearby.\n"
        "2. Trace solid piping lines connecting these tags to map edges. Differentiate the flow direction (source to target).\n"
        "3. Output a single valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"nodes\": [\n"
        "    {\n"
        "      \"id\": \"Tag identifier, e.g., P-101\",\n"
        "      \"type\": \"pump\" | \"valve\" | \"tank\" | \"vessel\" | \"column\" | \"indicator\" | \"instrument\",\n"
        "      \"description\": \"Specification details or labels\"\n"
        "    }\n"
        "  ],\n"
        "  \"edges\": [\n"
        "    {\n"
        "      \"source\": \"Source node tag ID\",\n"
        "      \"target\": \"Target node tag ID\",\n"
        "      \"relation\": \"discharges_to\" | \"feeds\" | \"monitors\" | \"bypasses\" | \"vents_to\"\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Important Constraints:\n"
        "- Only extract nodes and connections literally drawn in the diagram.\n"
        "- Do not wrap the JSON output in markdown codeblock wrappers. Output raw JSON only."
    )

    logger.info(f"Querying Vision LLM ({model_slug}) via OpenRouter...")
    response = client.chat.completions.create(
        model=model_slug,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": system_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image_b64}"
                        }
                    }
                ]
            }
        ],
        temperature=0.0
    )

    raw_text = response.choices[0].message.content
    if not raw_text:
        raise ValueError("Received empty response from Vision LLM.")

    cleaned_json = clean_json_response(raw_text)
    
    # Validate structure using Pydantic
    parsed_graph = TopologyGraph.model_validate_json(cleaned_json)
    return parsed_graph

def convert_to_okf_entities(graph: TopologyGraph, source_file: str) -> Dict[str, Any]:
    """
    Transforms the parsed nodes and edges list into the entities format ingested by build_graph.py.
    """
    entities = []
    
    # Map edges to quickly retrieve connections per node
    connections: Dict[str, List[str]] = {}
    for edge in graph.edges:
        connections.setdefault(edge.source, []).append(edge.target)
        connections.setdefault(edge.target, []).append(edge.source)

    for node in graph.nodes:
        # Resolve all linked tags from edges
        linked = list(set(connections.get(node.id, [])))
        
        # Build node description containing relations
        outgoing = [e.target for e in graph.edges if e.source == node.id]
        incoming = [e.source for e in graph.edges if e.target == node.id]
        
        desc = node.description or f"Equipment tag {node.id} extracted from P&ID."
        if outgoing:
            desc += f" Downstream connections: {', '.join(outgoing)}."
        if incoming:
            desc += f" Upstream connections: {', '.join(incoming)}."

        # Map to build_graph.py schema structure
        entity = {
            "name": f"{node.type.capitalize()} {node.id}",
            "type": "concept" if node.type in ["pump", "tank", "vessel", "column"] else "procedure",
            "description": desc,
            "equipment_tags": [node.id],
            "regulatory_references": [],
            "linked_concepts": [f"{n}" for n in linked],
            "tags": [node.type, "topology", "p&id"]
        }
        entities.append(entity)
        
    return {"entities": entities}

def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vigil P&ID Vision Topology Extractor")
    parser.add_argument(
        "--input",
        required=True,
        help="Path to the P&ID image file (PNG or JPEG)"
    )
    parser.add_argument(
        "--output-dir",
        default="results_entities",
        help="Directory to save the generated entities JSON file"
    )
    parser.add_argument(
        "--model",
        default="google/gemini-2.5-flash",
        help="OpenRouter Vision model slug (defaults to google/gemini-2.5-flash)"
    )
    return parser.parse_args()

def main() -> None:
    load_dotenv()
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        logger.error("Missing OPENROUTER_API_KEY environment variable.")
        sys.exit(1)

    args = parse_arguments()
    
    try:
        # 1. Base64 encode diagram image
        logger.info(f"Encoding P&ID image: {args.input}")
        img_b64 = encode_image(args.input)

        # 2. Initialize OpenRouter client
        client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )

        # 3. Vision API Call with Pydantic validation
        topology = fetch_topology_from_llm(client, args.model, img_b64)
        logger.info(f"Successfully extracted {len(topology.nodes)} nodes and {len(topology.edges)} edges.")

        # 4. Convert to OKF format compatible with build_graph.py
        source_basename = os.path.basename(args.input)
        okf_data = convert_to_okf_entities(topology, source_basename)

        # 5. Save output file
        os.makedirs(args.output_dir, exist_ok=True)
        output_filename = f"{source_basename}.json"
        output_filepath = os.path.join(args.output_dir, output_filename)
        
        with open(output_filepath, "w", encoding="utf-8") as out_f:
            json.dump(okf_data, out_f, indent=2)

        logger.info(f"Ingest-ready entities written successfully to: {output_filepath}")
        logger.info("Run 'python apps/backend/scripts/build_graph.py' to update the knowledge graph.")

    except Exception as e:
        logger.error(f"P&ID Topology Extraction failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
