# Contradiction Detection Failure Taxonomy Report

This report analyzes the failure modes of Vigil's proactive contradiction detection system. We evaluate the detector against the 42-pair safety and compliance benchmark to map out its competence boundaries and identify false positives.

---

## 1. Failure Taxonomy Table

Below is the taxonomy of detected vs missed contradictions categorized by conflict type:

| Category | Total Pairs in Benchmark | Detected | Missed (False Negatives) | Miss Rate | Missed Pair IDs |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **explicit_numeric** | 10 | 10 | 0 | 0.0% | None |
| **unit_conversion** | 2 | 2 | 0 | 0.0% | None |
| **implicit_operational** | 6 | 3 | 3 | 50.0% | 25, 35, 37 |
| **multi_hop** | 3 | 0 | 3 | 100.0% | 23, 39, 41 |
| **Total** | **21** | **15** | **6** | **28.6%** | **23, 25, 35, 37, 39, 41** |

---

## 2. Findings & Performance Analysis

### Competence Boundary
Vigil's contradiction detector exhibits a clear competence boundary:
- **Inside the Boundary**: The system is highly competent at detecting explicit numerical contradictions (e.g., maximum pressure limits vs operational setpoints).
- **Outside the Boundary**: The system struggles with implicit operational schedule logic (such as tracking shift work hours, temporal expirations, or overlapping windows) and multi-hop safety rules that require chaining facts across two or more documents (such as linking a regulation's testing ratio with design specifications and test procedures).
- **Category Sample-Size Warning**: While the multi-hop category shows a 100% failure rate, the cohort is extremely thin (n=3) to declare a absolute category boundary, though it represents a clear qualitative limit.

### Failure Mode: Non-Detection, Not Miscalibration
A review of the confidence scores of the 6 missed contradictions (False Negatives) reveals that every single miss scored exactly **0.00** rather than scoring near the threshold of 0.70. 

This indicates that the primary failure mode is **non-detection** (the LLM fails to identify any logical relation between the documents) rather than **miscalibration** (the LLM detects the conflict but assigns low confidence). Consequently, no amount of threshold tuning or calibration can recover these misses. Improving detection of these cases requires structural upgrades, such as multi-hop context retrieval, prompt decomposition, or agentic planning.

---

## 3. False Positive Analysis & The Unit Mismatch Bug

In addition to false negatives, the benchmark run at threshold 0.7 flagged **2 false positives**:

* **Pair 32** (Expected: Clean): Valve V-202 Limit (100 PSI) vs Operating Target (0.55 MPa = 79.7 PSI, which is below the limit and compliant). Flagged as a contradiction with **0.95** confidence.
* **Pair 34** (Expected: Clean): Vessel T-301 Limit (150 C) vs Wash target (250 F = 121 C, which is below the limit and compliant). Flagged as a contradiction with **0.98** confidence.

### The Unit Mismatch Bug Explanation
These two false positives reveal the sharpest reasoning limitation of the contradiction detector: **the detector treats unit mismatch as a contradiction signal rather than converting the quantities.**

When the model is presented with different units ("PSI" vs "MPa", or "C" vs "F"), it bypasses numerical conversion and asserts a conflict based on semantic mismatch. This means that although the contradictory unit-conversion pairs (31 and 33) were successfully flagged (2/2 recall), they were flagged *for the wrong reason* (unit mismatch), while the clean control pairs (32 and 34) were falsely flagged (100% false positive rate on controls). 

True unit-conversion capability remains a limitation of the current prompts and requires a structured tool or pre-parsing numeric normalization step to resolve.
