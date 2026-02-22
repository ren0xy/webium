---
name: selfimprove-reflect
description: Triggered when all spec tasks are complete. Reads the worklog, extracts reusable knowledge, and distributes it to focused gen-kb-* skills — creating new ones or appending to existing ones as appropriate.
---

# Reflect on Worklog

## When to Use

This skill triggers once all tasks in a `.kiro/specs/*/tasks.md` file are marked complete. It distills the spec's worklog into reusable, localized knowledge skills.

## Instructions

1. Read the spec's `worklog.md` in full.
2. Identify valuable knowledge entries: patterns, gotchas, tool quirks, architectural decisions, configuration insights, syntax traps, approach preferences.
3. For each knowledge entry:
   a. Scan existing `.kiro/skills/gen-kb-*/SKILL.md` files.
   b. If a suitable skill exists (topic/area matches), append the knowledge to its body.
   c. If no suitable skill exists, create a new one at `.kiro/skills/gen-kb-<topic>/SKILL.md`.
4. Skip trivial or obvious knowledge. Only capture what a future reader would find valuable.

## Format for New gen-kb-* Skills

```yaml
---
name: gen-kb-<topic>
description: <One sentence describing the knowledge area and when it's relevant.>
---
```

Body should contain knowledge entries in this format:

```markdown
### <Short title>
<1-3 sentences of distilled knowledge.>
```

## Rules

- Each gen-kb-* skill should be focused on a specific area (e.g., `gen-kb-unity-uitoolkit`, `gen-kb-esbuild-bundling`, `gen-kb-puerts-runtime`).
- Don't create overly broad skills. Split by domain, tool, or problem area.
- Don't duplicate knowledge that already exists in a gen-kb-* skill.
- The `name` field must match the directory name, use only lowercase letters, numbers, and hyphens.
- Keep descriptions concise — they're loaded at startup for all skills.
