"""Audit runner: calls Vigil's unmodified check_contradiction() on all 42 pairs.
Records raw output per pair and flags API/parse failures (which the repo function
silently maps to detected=False, confidence=0.0)."""
import json, os, sys, time, datetime, logging, subprocess
REPO = sys.argv[1]; OUT = sys.argv[2]
sys.path.insert(0, os.path.join(REPO, "apps", "backend"))
os.chdir(REPO)
from dotenv import load_dotenv; load_dotenv(os.path.join(REPO, ".env"))
import scripts.contradiction as C
import shared_utils as SU
failures = {}
cur = {"pid": None}
orig_warn = C.logger.warning
def warn(msg, *a, **k):
    failures[cur["pid"]] = str(msg)[:300]
    orig_warn(msg, *a, **k)
C.logger.warning = warn
usage = {"in": 0, "out": 0}
orig_call = SU.call_llm
def call_llm(*a, **k):
    r = orig_call(*a, **k)
    u = r
    if True:
        usage["in"] += getattr(u, "input_tokens", 0) or 0
        usage["out"] += getattr(u, "output_tokens", 0) or 0
    return r
C.call_llm = call_llm
cases = json.load(open("tests/contradiction_benchmark.json"))
rows = []
for c in cases:
    cur["pid"] = c["pair_id"]
    for attempt in range(4):
        failures.pop(c["pair_id"], None)
        res = C.check_contradiction(c["ent_a"], c["ent_b"])
        if c["pair_id"] not in failures: break
        time.sleep(8 * (attempt + 1))
    rows.append({"pair_id": c["pair_id"], "expected": c["contradiction_expected"],
                 "detected": bool(res.get("contradiction_detected", False)),
                 "confidence": res.get("confidence_score"),
                 "severity": res.get("severity"), "explanation": res.get("explanation", ""),
                 "call_failed": c["pair_id"] in failures, "failure_msg": failures.get(c["pair_id"]),
                 "attempts": attempt + 1})
    print(c["pair_id"], rows[-1]["expected"], rows[-1]["detected"], rows[-1]["confidence"], "FAIL" if rows[-1]["call_failed"] else "", flush=True)
    time.sleep(1.5)
meta = {"run_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "model": SU.MODEL_ROUTER["contradiction"], "temperature": 0.0,
        "backend": "bedrock" if SU.is_bedrock_configured() else "openrouter_fallback",
        "function": "apps/backend/scripts/contradiction.py::check_contradiction (unmodified)",
        "runner": "audit runner (not committed script); retries a pair up to 4x on API/parse failure",
        "token_usage": usage}
json.dump({"meta": meta, "rows": rows}, open(OUT, "w"), indent=2)
print("META", json.dumps(meta))
