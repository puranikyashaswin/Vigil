"""
Script to clean and deduplicate RAGAS interaction logs.
"""

import os
import re
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

# Constants
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs", "ragas")
INPUT_FILE = os.path.join(LOGS_DIR, "interactions.jsonl")
OUTPUT_CLEAN_FILE = os.path.join(LOGS_DIR, "interactions.clean.jsonl")
OUTPUT_MANIFEST_FILE = os.path.join(LOGS_DIR, "eval_manifest.json")

# Regex pattern for greeting after normalization
GREETING_REGEX = re.compile(r"^(hii|hiii|hi|hello|hey)\b", re.IGNORECASE)

# Noise check phrases
NOISE_PHRASES = ["% faster", "faster", "tab-separated timings"]


def normalise_question(question: str) -> str:
    """
    Normalise question for matching by stripping, collapsing whitespace,
    and converting to lowercase.
    """
    if not question:
        return ""
    # Collapse internal whitespace, tabs, and newlines to single spaces
    collapsed = " ".join(question.strip().split())
    return collapsed.lower()


def parse_timestamp(ts_str: Optional[str]) -> datetime:
    """
    Safely parse ISO timestamp into datetime object.
    """
    if not ts_str:
        return datetime.min
    try:
        cleaned_ts = ts_str
        if ts_str.endswith("Z"):
            cleaned_ts = ts_str[:-1]
        return datetime.fromisoformat(cleaned_ts)
    except Exception:
        return datetime.min


def get_telemetry_source(contexts: List[str]) -> str:
    """
    Determine the telemetry source by scanning contexts.
    """
    # Scan contexts for telemetry source substring
    for context in contexts:
        if not isinstance(context, str):
            continue
        if "IoT Mock Server" in context:
            return "mock_server"
        if "LOCAL FALLBACK" in context:
            return "local_fallback"
    return "none"


def main() -> None:
    """
    Main function to run the RAGAS log cleaning process.
    """
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file {INPUT_FILE} does not exist.")
        return

    total_in = 0
    kept_before_dedupe: List[Dict[str, Any]] = []
    
    dropped_breakdown = {
        "empty_contexts": 0,
        "greeting": 0,
        "noise_perf_line": 0
    }

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            line_str = line.strip()
            if not line_str:
                continue
            
            total_in += 1
            try:
                entry = json.loads(line_str)
            except Exception as e:
                print(f"Error parsing JSON on line {idx}: {e}")
                continue

            question = entry.get("question", "")
            contexts = entry.get("contexts", [])
            answer = entry.get("answer", "")
            timestamp = entry.get("timestamp")

            # Normalise question
            norm_q = normalise_question(question)

            # Flags classification
            has_contexts = len(contexts) > 0
            is_greeting = bool(GREETING_REGEX.match(norm_q))
            is_noise = any(phrase in norm_q for phrase in NOISE_PHRASES)
            telemetry = get_telemetry_source(contexts)

            # Check drop condition
            if has_contexts and not is_greeting and not is_noise:
                # Add telemetry source to the entry dictionary
                entry["telemetry_source"] = telemetry
                entry["normalised_q"] = norm_q
                kept_before_dedupe.append(entry)
            else:
                # Classify drop reason
                if is_greeting:
                    dropped_breakdown["greeting"] += 1
                elif is_noise:
                    dropped_breakdown["noise_perf_line"] += 1
                else:
                    dropped_breakdown["empty_contexts"] += 1

    # Group kept entries by normalised question
    grouped_entries: Dict[str, List[Dict[str, Any]]] = {}
    for entry in kept_before_dedupe:
        norm_q = entry["normalised_q"]
        grouped_entries.setdefault(norm_q, []).append(entry)

    # Winners list
    winners: List[Dict[str, Any]] = []
    duplicate_groups_collapsed: Dict[str, int] = {}

    # Define telemetry priority
    telemetry_priority = {
        "mock_server": 2,
        "local_fallback": 1,
        "none": 0
    }

    for norm_q, group in grouped_entries.items():
        # Choose winner
        # Sort key helper: priority (descending), then timestamp (descending)
        def sort_key(x: Dict[str, Any]) -> Tuple[int, datetime]:
            prio = telemetry_priority.get(x["telemetry_source"], 0)
            parsed_ts = parse_timestamp(x.get("timestamp"))
            return (prio, parsed_ts)

        # Sort group descending
        sorted_group = sorted(group, key=sort_key, reverse=True)
        winner = sorted_group[0]
        winners.append(winner)

        # Track collapsed duplicates
        if len(group) > 1:
            # Key by winner's original question
            original_q = winner.get("question", norm_q)
            duplicate_groups_collapsed[original_q] = len(group)

    # Calculate statistics
    total_kept = len(winners)
    total_dropped = total_in - total_kept

    # Count telemetry source split among winners
    telemetry_source_split = {
        "mock_server": 0,
        "local_fallback": 0,
        "none": 0
    }
    for winner in winners:
        telemetry = winner["telemetry_source"]
        if telemetry in telemetry_source_split:
            telemetry_source_split[telemetry] += 1
        else:
            telemetry_source_split[telemetry] = 1

    # Ensure output directory exists
    os.makedirs(LOGS_DIR, exist_ok=True)

    # Write cleaned file
    with open(OUTPUT_CLEAN_FILE, "w", encoding="utf-8") as f_out:
        for winner in winners:
            clean_entry = {
                "question": winner.get("question"),
                "contexts": winner.get("contexts"),
                "answer": winner.get("answer"),
                "telemetry_source": winner["telemetry_source"]
            }
            if "timestamp" in winner:
                clean_entry["timestamp"] = winner["timestamp"]
            f_out.write(json.dumps(clean_entry) + "\n")

    # Construct manifest JSON
    manifest = {
        "source_file": os.path.relpath(INPUT_FILE, PROJECT_ROOT),
        "generated_at": datetime.now().isoformat(),
        "total_in": total_in,
        "total_kept": total_kept,
        "total_dropped": total_dropped,
        "dropped_breakdown": dropped_breakdown,
        "duplicate_groups_collapsed": duplicate_groups_collapsed,
        "telemetry_source_split": telemetry_source_split
    }

    # Write manifest file
    with open(OUTPUT_MANIFEST_FILE, "w", encoding="utf-8") as f_man:
        json.dump(manifest, f_man, indent=2)

    print(f"Cleaned {total_in} logs into {total_kept} items.")
    print(f"Manifest written to {OUTPUT_MANIFEST_FILE}")


if __name__ == "__main__":
    main()
