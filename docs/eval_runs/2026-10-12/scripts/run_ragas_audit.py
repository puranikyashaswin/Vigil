"""Audit re-run of apps/backend/scripts/run_ragas_eval.py logic.
Same benchmark (tests/eval_benchmark.json), same agent graph, same refusal keywords,
same RAGAS metrics and FastEmbed embeddings. Differences: writes to an audit folder
instead of overwriting docs/, pins the judge model (repo uses the 'openrouter/free'
router, which picks an arbitrary free model), and saves every answer + per-row scores."""
import os, sys, json, time, datetime, subprocess, math
REPO, OUTDIR, JUDGE = sys.argv[1], sys.argv[2], sys.argv[3]
os.chdir(REPO); sys.path.insert(0, os.path.join(REPO, "apps", "backend"))
from dotenv import load_dotenv; load_dotenv(os.path.join(REPO, ".env"))
os.environ["QDRANT_URL"] = ""; os.environ["LANGSMITH_TRACING"] = "false"
from types import ModuleType
m = ModuleType("langchain_community.chat_models.vertexai"); m.ChatVertexAI = None
sys.modules["langchain_community.chat_models.vertexai"] = m
import anthropic.resources.messages as AM
usage = {"calls": 0, "in": 0, "out": 0, "by_model": {}}
_orig = AM.Messages.create
def _create(self, *a, **k):
    r = _orig(self, *a, **k)
    try:
        usage["calls"] += 1; usage["in"] += r.usage.input_tokens; usage["out"] += r.usage.output_tokens
        bm = usage["by_model"].setdefault(k.get("model", "?"), [0, 0]); bm[0] += r.usage.input_tokens; bm[1] += r.usage.output_tokens
    except Exception: pass
    return r
AM.Messages.create = _create
from graph import app as agent_graph
import shared_utils as SU
REFUSAL = ["insufficient","error","not found","not documented","unable to answer","refuse","do not have",
  "no relevant equipment","no information","unable to supply","cannot be determined","not mention","cannot answer",
  "no document","not present","unable to retrieve","no standard or regulation","not referenced","cannot provide","no source document"]
bench = json.load(open("tests/eval_benchmark.json"))
os.makedirs(OUTDIR, exist_ok=True)
answers_path = os.path.join(OUTDIR, "ragas_answers.jsonl")
done = {}
if os.path.exists(answers_path):
    for l in open(answers_path): j = json.loads(l); done[j["question"]] = j
with open(answers_path, "a") as fa:
    for i, item in enumerate(bench):
        q = item["question"]
        if q in done: continue
        st = {"query": q, "category": "", "retrieved_contexts": [], "citations": [], "generated_response": "", "ragas_log": None, "metadata": {}}
        t = time.time(); err = None
        try:
            fs = agent_graph.invoke(st); ctx = fs.get("retrieved_contexts", []) or []; ans = fs.get("generated_response", "") or ""
        except Exception as e:
            ctx, ans, err = [], "", repr(e)[:300]
        rec = {"idx": i, "question": q, "in_scope": item.get("in_scope", True), "ground_truth": item["ground_truth"],
               "contexts": ctx, "answer": ans, "error": err, "latency_s": round(time.time() - t, 1),
               "refusal_keyword_hit": any(kw in ans.lower() for kw in REFUSAL), "empty_contexts": not ctx}
        fa.write(json.dumps(rec) + "\n"); fa.flush(); done[q] = rec
        print(f"[{i+1}/40] in_scope={rec['in_scope']} err={bool(err)} refusal_kw={rec['refusal_keyword_hit']} ctx={len(ctx)} {rec['latency_s']}s", flush=True)
json.dump(usage, open(os.path.join(OUTDIR, "agent_token_usage.json"), "w"), indent=2)
recs = [done[b["question"]] for b in bench]
ins = [r for r in recs if r["in_scope"]]; oos = [r for r in recs if not r["in_scope"]]
# RAGAS on in-scope, same config as repo script except judge model
import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.run_config import RunConfig
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from langchain_openai import ChatOpenAI
from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_core.messages import AIMessage
class BedrockClaudeJudge(BaseChatModel):
    """Minimal LangChain wrapper over the anthropic Bedrock client already used by Vigil."""
    model_id: str
    temperature: float = 0.0
    @property
    def _llm_type(self): return "bedrock-claude-judge"
    def _generate(self, messages, stop=None, run_manager=None, **kw):
        system = "\n".join(m.content for m in messages if m.type == "system")
        msgs = [{"role": "assistant" if m.type == "ai" else "user", "content": m.content} for m in messages if m.type != "system"]
        client = SU._get_bedrock_client()
        args = dict(model=self.model_id, max_tokens=4096, temperature=kw.get("temperature", self.temperature), messages=msgs)
        if system: args["system"] = system
        for attempt in range(6):
            try:
                r = client.messages.create(**args); break
            except Exception as e:
                if attempt == 5: raise
                time.sleep(5 * (attempt + 1))
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=r.content[0].text))])
if JUDGE.startswith("bedrock:"):
    llm = BedrockClaudeJudge(model_id=JUDGE.split(":", 1)[1], temperature=0.0)
else:
    llm = ChatOpenAI(api_key=os.getenv("OPENROUTER_API_KEY"), base_url="https://openrouter.ai/api/v1", model=JUDGE, temperature=0.0)
class TextEmbeddingStringMock(str):
    def __new__(cls, value, model_obj):
        o = super().__new__(cls, value); o.model_obj = model_obj; return o
    def __getattr__(self, name): return getattr(self.model_obj, name)
emb = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5"); emb.model = TextEmbeddingStringMock("BAAI/bge-small-en-v1.5", emb.model)
ds = Dataset.from_pandas(pd.DataFrame([{"question": r["question"], "contexts": r["contexts"] or [""],
      "answer": r["answer"] or "Error: Insufficient context", "ground_truth": r["ground_truth"]} for r in ins]))
res = evaluate(dataset=ds, metrics=[faithfulness, answer_relevancy, context_precision, context_recall], llm=llm, embeddings=emb,
               run_config=RunConfig(timeout=180, max_retries=20, max_workers=2), batch_size=2)
df = res.to_pandas(); df.to_csv(os.path.join(OUTDIR, "ragas_scores.csv"), index=False)
mets = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
summ = {k: {"mean": (round(float(df[k].mean()), 4) if df[k].notna().any() else None), "n_scored": int(df[k].notna().sum()), "n_nan": int(df[k].isna().sum())} for k in mets}
import random
rng = random.Random(20261012); ci = {}
for k in mets:
    v = [x for x in df[k].tolist() if x == x]
    if v:
        bs = sorted(sum(rng.choice(v) for _ in v) / len(v) for _ in range(10000)); ci[k] = [round(bs[249], 4), round(bs[9749], 4)]
out = {"meta": {"run_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "git_dirty_note": "working tree had uncommitted knowledge_graph/ changes; Qdrant index = local vigil_qdrant.db (collection vigil_okf, 96 points)",
        "agent_backend": "bedrock" if SU.is_bedrock_configured() else "openrouter_fallback", "agent_models": SU.MODEL_ROUTER,
        "reranking": os.getenv("ENABLE_RERANKING", "false"), "judge": JUDGE, "ragas_version": __import__("ragas").__version__,
        "embeddings": "fastembed BAAI/bge-small-en-v1.5"},
       "in_scope_n": len(ins), "out_of_scope_n": len(oos), "ragas_in_scope": summ, "ragas_bootstrap_ci95": ci,
       "agent_errors": sum(1 for r in recs if r["error"]),
       "out_of_scope_correct_refusals_keyword_or_empty_ctx": sum(1 for r in oos if r["refusal_keyword_hit"] or r["empty_contexts"] or r["error"]),
       "out_of_scope_refusal_note": "repo heuristic: refusal keyword in answer OR empty contexts; errors count as refusals in the repo script",
       "in_scope_refusal_keyword_hits": [r["idx"] for r in ins if r["refusal_keyword_hit"]],
       "agent_token_usage": usage}
json.dump(out, open(os.path.join(OUTDIR, "ragas_summary.json"), "w"), indent=2)
print(json.dumps(out, indent=1))
