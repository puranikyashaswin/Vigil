import json, random, statistics as st, sys, math
d = json.load(open(sys.argv[1])); out = sys.argv[2]
rows = [r for r in d["rows"] if not r["call_failed"]]
excluded = [r["pair_id"] for r in d["rows"] if r["call_failed"]]
def prf(rs, th=0.7):
    tp = sum(r["expected"] and r["detected"] and r["confidence"] >= th for r in rs)
    fp = sum((not r["expected"]) and r["detected"] and r["confidence"] >= th for r in rs)
    fn = sum(r["expected"] for r in rs) - tp
    tn = len(rs) - tp - fp - fn
    p = tp / (tp + fp) if tp + fp else float("nan")
    r = tp / (tp + fn) if tp + fn else float("nan")
    f = 2 * p * r / (p + r) if (p + r) and not math.isnan(p) and not math.isnan(r) else float("nan")
    return dict(tp=tp, fp=fp, tn=tn, fn=fn, precision=p, recall=r, f1=f)
sweep = {th: prf(rows, th) for th in (0.5, 0.6, 0.7, 0.8)}
B = 10000; rng = random.Random(20261012); boots = {"precision": [], "recall": [], "f1": []}; undefined = 0
for _ in range(B):
    s = [rows[rng.randrange(len(rows))] for _ in rows]
    m = prf(s)
    if any(math.isnan(m[k]) for k in boots): undefined += 1; continue
    for k in boots: boots[k].append(m[k])
def pct(v, q): v = sorted(v); return v[min(len(v) - 1, int(q * len(v)))]
ci = {k: [round(pct(v, 0.025), 4), round(pct(v, 0.975), 4)] for k, v in boots.items()}
# exact Clopper-Pearson lower bound for precision when FP=0: (alpha/2)^(1/n)
tp = sweep[0.7]["tp"]
cp_prec_lower = round(0.025 ** (1 / tp), 4) if sweep[0.7]["fp"] == 0 else None
conf_c = [r["confidence"] for r in rows if r["expected"]]; conf_n = [r["confidence"] for r in rows if not r["expected"]]
summary = {"source": sys.argv[1], "meta": d["meta"], "n_scored": len(rows), "excluded_pairs_call_failed": excluded,
  "n_contradictory": sum(r["expected"] for r in rows), "n_clean": sum(not r["expected"] for r in rows),
  "threshold_sweep": {str(k): {kk: (round(vv, 4) if isinstance(vv, float) else vv) for kk, vv in v.items()} for k, v in sweep.items()},
  "bootstrap": {"method": "nonparametric percentile bootstrap over pairs, threshold 0.7", "B": B, "seed": 20261012,
                "resamples_with_undefined_metric_dropped": undefined, "ci95": ci},
  "precision_exact_clopper_pearson_95_lower": cp_prec_lower,
  "missed_pairs": [r["pair_id"] for r in rows if r["expected"] and not r["detected"]],
  "missed_confidence": {r["pair_id"]: r["confidence"] for r in rows if r["expected"] and not r["detected"]},
  "confidence_note": "confidence_score is the model's confidence in its own verdict (clean or contradiction), not P(contradiction)",
  "confidence_contradictory": {"mean": round(st.mean(conf_c), 4), "median": st.median(conf_c)},
  "confidence_clean": {"mean": round(st.mean(conf_n), 4), "median": st.median(conf_n)}}
json.dump(summary, open(out, "w"), indent=2); print(json.dumps(summary, indent=1)[:2500])
