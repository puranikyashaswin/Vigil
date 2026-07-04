---
type: alert
title: "Conflict: Safety Valve V-202 Setpoint Mismatch"
description: "Process Procedure P-03 requires setting the bypass valve to 120 PSI, but Safety Regulation SR-12 strictly limits pressure to 100 PSI."
resource: "pipeline/session-contradiction"
tags: [conflict, alert, high]
timestamp: 2026-07-04T11:00:00
confidence_score: 0.85
severity: high
---

# Alert: Compliance Conflict Detected

A contradiction has been flagged between two linked concepts.

## Conflict Details
- **Conflicting Source A**: [Safety Regulation SR-12](../regulations/sr-12.md)
- **Conflicting Source B**: [Process Procedure P-03](../procedures/p-03.md)

## Audit Findings
Safety Regulation SR-12 explicitly limits the maximum operating pressure of V-202 to 100 PSI. However, Process Procedure P-03 instructs technicians to set the bypass pressure to 120 PSI, directly violating SR-12 and creating an overpressure explosion hazard.
