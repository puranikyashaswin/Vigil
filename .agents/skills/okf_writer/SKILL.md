---
name: okf_writer
description: "Use when creating or updating any OKF concept file, including entity extraction output and alert files"
---

# Open Knowledge Format (OKF) Writer Skill

This skill defines the precise procedures, structures, and guidelines for generating and maintaining OKF v0.1 concept bundles inside the Vigil platform.

---

## 1. Naming Conventions

All OKF concept files must follow these strict naming rules:
1. **Filename Derivation**: Convert the formal entity name/title into a URL-friendly slug.
2. **Format**: Lowercase letters, numbers, and hyphens (`-`) only. No spaces, underscores, or special characters.
3. **Extension**: Use the `.md` extension.
   * *Example*: A concept titled "Centrifugal Pump P-101" becomes `centrifugal-pump-p-101.md`.
   * *Example*: A regulation titled "OSHA Standard 1910.119" becomes `osha-standard-1910-119.md`.

---

## 2. OKF Bundle Directory Structure

The knowledge graph exists as a set of directories nested directly under the root OKF directory (e.g. `knowledge_graph/`). Use relative links to traverse sibling directories.

```
knowledge_graph/
├── index.md
├── log.md
├── equipment/
│   ├── index.md
│   ├── log.md
│   └── centrifugal-pump-p-101.md
├── procedures/
│   ├── index.md
│   ├── log.md
│   └── crude-feed-startup.md
├── regulations/
│   ├── index.md
│   ├── log.md
│   └── osha-psm-1910-119.md
├── maintenance/
│   ├── index.md
│   ├── log.md
│   └── log-2026-q2.md
└── alerts/
    ├── index.md
    ├── log.md
    └── conflict-crude-startup-safety.md
```

---

## 3. Schema and Linking Rules

All OKF files require a YAML frontmatter block matching the schema defined in [AGENTS.md Section 2](file:///Users/yashaswinsharma/Documents/github/vigil/AGENTS.md#L39-L54).

### Resource Field Value Conventions:
- **Regular Concepts (equipment, procedures, etc.)**: Path to original source document or external URL citation (e.g., `drawings/p-101-datasheet.pdf`).
- **Alert Concepts (`type: alert`)**: The pipeline session or execution ID where the conflict was detected (e.g., `pipeline/session-48ca`).

### Linking Rules:
- Refer to related files using relative paths from the current file: `[Link Text](../sibling-directory/filename.md)`.
- Use descriptive labels rather than generic terms.
- When generating links, verify that the target file exists or is scheduled to be created.

### Qdrant Ingestion Payload Schema:
During ingestion, each processed chunk from an OKF document must be embedded using the standardized model **`BAAI/bge-small-en-v1.5`** and stored in Qdrant with the following minimum payload metadata fields, enabling query-side directory filtering:
- `file_path`: Relative path of the source OKF file (e.g., `procedures/crude-feed-startup.md`).
- `directory`: The concept folder name (e.g., `procedures`, `regulations`, `equipment`, `alerts`).
- `text`: The raw text content of the chunk.
- `type`: The type matching the OKF frontmatter schema (e.g., `procedure`, `regulation`, `alert`).

---

## 4. Managing Index (`index.md`) & Log (`log.md`) Files

Every concept directory requires its own `index.md` and `log.md`.

### Index Files (`index.md`)
- **When to Create**: Create a new `index.md` if the directory is newly initialized.
- **When to Modify**: Every time a new concept file is written, append its reference to the local `index.md`.
- **Format**: A bulleted list of relative markdown links categorized by sub-concept, with a short description next to each link.

### Log Files (`log.md`)
- **When to Modify**: Every creation, modification, or deletion of a concept file must append a log entry to `log.md`.
- **Format**:
  - Date heading using standard Markdown formatting: `### YYYY-MM-DD`
  - Bold action word (e.g., **INGEST**, **UPDATE**, **LINK**, **ALERT**) followed by a clear, concise prose description of the change, references to files altered, and the timestamp.

---

## 5. Contradiction-Alert File Format

When a contradiction is detected by the Ingestion Pipeline (as specified in [AGENTS.md Section 4](file:///Users/yashaswinsharma/Documents/github/vigil/AGENTS.md#L80-L84)), write a dedicated contradiction alert file to the `alerts/` directory:
1. **Filename**: `conflict-[hash-or-slug].md`
2. **Type**: Must be `alert` in the YAML frontmatter.
3. **Required Alert Fields**: `confidence_score` (float 0.0 to 1.0) and `severity` (`low` | `medium` | `high` | `critical`).
4. **Contents**: Detailed explanation of the conflict, and clear relative links back to both conflicting concept files.

---

## 6. Worked Examples

### Example A: Equipment Concept File (`equipment/centrifugal-pump-p-101.md`)
```markdown
---
type: concept
title: "Centrifugal Pump P-101"
description: "Primary crude feeding pump located in Unit 12. Rated for 500 GPM at 150 PSI."
resource: "drawings/p-101-datasheet.pdf"
tags: [equipment, pump, crude-unit]
timestamp: 2026-07-04T09:15:38+05:30
---

# Centrifugal Pump P-101

Centrifugal Pump P-101 is the primary feed pump for the crude distillation tower. It operates continuously under standard operating parameters and is governed by [Crude Feed Startup Procedure](../procedures/crude-feed-startup.md).

## Technical Specifications
- **Manufacturer**: Flowserve
- **Model**: HPX 3x2x10
- **Flow Rate**: 500 GPM
- **Discharge Pressure**: 150 PSI

## Maintenance History
- Refer to [Maintenance Log 2026-Q2](../maintenance/log-2026-q2.md) for details on impeller replacement.
```

### Example B: Contradiction Alert Concept File (`alerts/conflict-crude-startup-safety.md`)
```markdown
---
type: alert
title: "Procedural Safety Conflict: Crude Startup and OSHA Pressure Rules"
description: "Ingestion pipeline flagged a contradiction between Crude Feed Startup Procedure and OSHA safety guidelines regarding system bypass limits."
resource: "pipeline/session-48ca"
tags: [contradiction, alert, safety, compliance]
timestamp: 2026-07-04T09:20:15+05:30
confidence_score: 0.94
severity: critical
---

# Alert: Procedural Safety Conflict

The automatic Ingestion Pipeline contradiction step identified a conflict between a newly updated procedure and a standing safety regulation.

## Conflict Details
- **Conflicting Source A**: [Crude Feed Startup Procedure](../procedures/crude-feed-startup.md)
  - *Stated Content*: In step 4.2, the operator is instructed to bypass the high-pressure interlock for up to 10 minutes to stabilize flow during startup.
- **Conflicting Source B**: [OSHA Standard 1910.119 - Process Safety Management](../regulations/osha-psm-1910-119.md)
  - *Stated Content*: Section (j)(4) prohibits manual bypasses of critical safety-instrumented systems (SIS) for longer than 3 minutes without written supervisor override.

## Actions Required
1. Review [Crude Feed Startup Procedure](../procedures/crude-feed-startup.md) to bring the bypass duration limits into compliance.
2. Alert the operations supervisor and halt training runs using the obsolete procedure version.
```
