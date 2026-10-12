"""Time plain text extraction with pdfplumber vs PyMuPDF on the PDFs in test_documents/ (median of 3 runs each)."""
import sys, os, time, json, statistics, platform
import fitz, pdfplumber
d = sys.argv[1]; out = sys.argv[2]; rows = []
for f in sorted(os.listdir(d)):
    if not f.lower().endswith(".pdf"): continue
    p = os.path.join(d, f); res = {"file": f, "bytes": os.path.getsize(p)}
    for name, fn in [("pdfplumber", lambda: "\n".join((pg.extract_text() or "") for pg in pdfplumber.open(p).pages)),
                     ("pymupdf", lambda: "\n".join(pg.get_text() for pg in fitz.open(p)))]:
        ts = []
        for _ in range(3):
            t = time.perf_counter(); txt = fn(); ts.append(time.perf_counter() - t)
        res[name + "_median_s"] = round(statistics.median(ts), 3); res[name + "_chars"] = len(txt)
    res["pymupdf_time_reduction_pct"] = round(100 * (1 - res["pymupdf_median_s"] / res["pdfplumber_median_s"]), 1)
    rows.append(res); print(res, flush=True)
json.dump({"machine": platform.platform(), "python": platform.python_version(), "pymupdf": fitz.VersionBind, "pdfplumber": pdfplumber.__version__,
           "note": "other processes were running on the machine; timings are indicative", "rows": rows}, open(out, "w"), indent=2)
