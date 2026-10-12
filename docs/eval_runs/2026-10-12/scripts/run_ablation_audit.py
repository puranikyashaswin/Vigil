"""Calls the unmodified evaluate_retrieval() from apps/backend/scripts/run_retrieval_ablation.py and saves JSON (no LLM calls)."""
import os, sys, json, datetime, subprocess, importlib.util
REPO, OUT = sys.argv[1], sys.argv[2]
os.chdir(REPO); sys.path.insert(0, os.path.join(REPO, "apps", "backend"))
from dotenv import load_dotenv; load_dotenv(os.path.join(REPO, ".env"))
os.environ["QDRANT_URL"] = ""; os.environ["LANGSMITH_TRACING"] = "false"
spec = importlib.util.spec_from_file_location("abl", os.path.join(REPO, "apps/backend/scripts/run_retrieval_ablation.py"))
abl = importlib.util.module_from_spec(spec); spec.loader.exec_module(abl)
res = {}
for rr in (False, True):
    h, m = abl.evaluate_retrieval(rr); res["with_flashrank" if rr else "without_reranking"] = {"hit_at_5": round(h, 4), "mrr": round(m, 4)}
out = {"run_at": datetime.datetime.now().isoformat(timespec="seconds"), "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
       "n_queries": len(abl.EXPECTED_DOCS_MAPPING), "index": "local vigil_qdrant.db (vigil_okf)", "results": res,
       "delta": {"hit_at_5": round(res["with_flashrank"]["hit_at_5"] - res["without_reranking"]["hit_at_5"], 4), "mrr": round(res["with_flashrank"]["mrr"] - res["without_reranking"]["mrr"], 4)}}
json.dump(out, open(OUT, "w"), indent=2); print(json.dumps(out, indent=1))
