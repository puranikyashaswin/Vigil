# Contradiction Detection Evaluation Report

This report evaluates Vigil's proactive contradiction detection node. The model is tested against a labeled dataset of 42 concept pairs containing known contradictions and clean safety-critical specifications.

**Note**: The evaluation pairs were authored with AI assistance, with a set of hard pairs hand-written to mitigate construction bias. Independent evaluation is future work.

## Confidence Score Distribution

To evaluate how effectively the classifier separates contradictions from clean pairs, we report the distribution of confidence scores across both cohorts:

| Cohort | Count | Average Confidence | Median Confidence |
| :--- | :---: | :---: | :---: |
| **Contradictory Pairs** | 21 | 0.6995 | 0.9500 |
| **Clean Control Pairs** | 21 | 0.0919 | 0.0000 |

## Threshold Sweep Results

| Threshold | TP | FP | TN | FN | Precision | Recall | F1-Score |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0.5 | 15 | 2 | 19 | 6 | 0.8824 | 0.7143 | 0.7895 |
| 0.6 | 15 | 2 | 19 | 6 | 0.8824 | 0.7143 | 0.7895 |
| 0.7 | 15 | 2 | 19 | 6 | 0.8824 | 0.7143 | 0.7895 |
| 0.8 | 15 | 2 | 19 | 6 | 0.8824 | 0.7143 | 0.7895 |

## Threshold Choice Analysis

Empirical sweep results show that detection performance is completely insensitive to the threshold choice in the 0.5 to 0.8 range. This flat performance curve is explained by the bimodal distribution of confidence scores: the LLM outputs high confidence scores (>=0.85) for true contradictions and low confidence scores (0.00) for clean pairs, with virtually no scores in the intermediate range.

We retain **0.7** as the default threshold. This provides a robust safety margin, preventing any marginal noise from triggering false compliance alerts while ensuring maximum precision in industrial workflows.

## Detailed Performance Breakdown

| Pair ID | Concept A | Concept B | Expected Contradiction | LLM Confidence | Result (at 0.7) |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | Safety Regulation SR-12 | Operating Procedure P-03 | Yes | 1.00 | TP |
| 2 | P&ID Completeness Checklist | Pump P-102 Maintenance Log | Yes | 0.95 | TP |
| 3 | Safety Regulation SR-12 | Valve V-202 Maintenance Log | No | 0.00 | TN |
| 4 | 29 CFR 1910.119 | Clean Air Act Amendments | No | 0.00 | TN |
| 5 | Safety Regulation SR-13 | Operating Procedure P-04 | Yes | 1.00 | TP |
| 6 | Safety Regulation SR-13 | Tank T-301 Maintenance Log | No | 0.00 | TN |
| 7 | Piping Standards P-05 | Line 105 Specifications | Yes | 1.00 | TP |
| 8 | Piping Standards P-05 | Line 102 Specifications | No | 0.00 | TN |
| 9 | OSHA 1910.147 Standard | Panel Maintenance Procedure P-12 | Yes | 0.95 | TP |
| 10 | OSHA 1910.147 Standard | Switchgear Servicing P-11 | No | 0.00 | TN |
| 11 | Pump P-101 Specifications | Transfer Procedure P-08 | Yes | 1.00 | TP |
| 12 | Pump P-101 Specifications | Normal Transfer P-07 | No | 0.00 | TN |
| 13 | OSHA Noise Standard | Compressor Room Procedure P-15 | Yes | 1.00 | TP |
| 14 | OSHA Noise Standard | Generator Vault Entry P-16 | No | 0.00 | TN |
| 15 | Confined Space Entry Standard | Vessel Cleanout Procedure P-21 | Yes | 0.95 | TP |
| 16 | Confined Space Entry Standard | Column Inspection Procedure P-22 | No | 0.00 | TN |
| 17 | Vessel T-301 Design Data | Pressurization Step P-09 | Yes | 1.00 | TP |
| 18 | Vessel T-301 Design Data | Normal Operating Rules P-10 | No | 0.00 | TN |
| 19 | EPA Wastewater Standard | Effluent Flush Procedure P-33 | Yes | 1.00 | TP |
| 20 | EPA Wastewater Standard | Sump Cleanout Procedure P-34 | No | 0.00 | TN |
| 21 | Hot Work Permit Standards | Welding General Procedure P-40 | Yes | 0.95 | TP |
| 22 | Hot Work Permit Standards | Pipe Fitting Repairs P-41 | No | 0.00 | TN |
| 23 | Valve V-202 Material Specs | Sour Gas Start Step P-50 | Yes | 0.00 | FN |
| 24 | Valve V-202 Material Specs | Sweet Gas Process P-51 | No | 0.00 | TN |
| 25 | Crane Safety Standards | Overhead Crane 01 Log | Yes | 0.00 | FN |
| 26 | Crane Safety Standards | Overhead Crane 02 Log | No | 0.00 | TN |
| 27 | HAZWOPER Standard | Spill Management Plan P-60 | Yes | 0.95 | TP |
| 28 | HAZWOPER Standard | Spill Response Procedure P-61 | No | 0.00 | TN |
| 29 | Pump P-102 Specifications | Pump P-102 Maintenance Log | Yes | 1.00 | TP |
| 30 | Pump P-102 Specifications | Pump P-101 Maintenance Log | No | 0.00 | TN |
| 31 | Valve V-202 Limits | Operating Procedure P-03 | Yes | 0.95 | TP |
| 32 | Valve V-202 Limits | Operating Procedure P-04 | No | 0.95 | FP |
| 33 | Safety Regulation SR-13 | Operating Procedure P-05 | Yes | 0.99 | TP |
| 34 | Safety Regulation SR-13 | Operating Procedure P-06 | No | 0.98 | FP |
| 35 | Pump P-101 Maintenance Log | Operating Procedure P-08 | Yes | 0.00 | FN |
| 36 | Pump P-101 Maintenance Log | Operating Procedure P-09 | No | 0.00 | TN |
| 37 | Shift Safety Standards | Operating Procedure P-18 | Yes | 0.00 | FN |
| 38 | Shift Safety Standards | Operating Procedure P-19 | No | 0.00 | TN |
| 39 | Vessel T-301 Design specifications | Testing Procedure P-24 | Yes | 0.00 | FN |
| 40 | Vessel T-301 Design specifications | Testing Procedure P-25 | No | 0.00 | TN |
| 41 | Vessel V-202 Nitrogen service specifications | Entry Procedure P-28 | Yes | 0.00 | FN |
| 42 | Vessel V-202 Nitrogen service specifications | Entry Procedure P-29 | No | 0.00 | TN |
