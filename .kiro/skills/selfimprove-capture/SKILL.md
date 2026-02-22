---
name: selfimprove-capture
description: Captures verified knowledge from non-task chat sessions — architectural decisions, code behavior insights, undocumented parameters — and distributes it to gen-kb-* skills. Requires high certainty before logging.
---

# Capture Verified Knowledge from Chat

## When to Use

Activate during free-form chat sessions (not spec-task work) when the conversation produces knowledge worth preserving. This includes:

- Architectural decisions confirmed by the user.
- Insights into how a specific code segment actually behaves (especially undocumented or surprising behavior).
- Hidden parameters, implicit contracts, or undocumented configuration that was discovered and validated.
- Workarounds or patterns confirmed to solve a real problem.

## Certainty Threshold

Do NOT log knowledge speculatively. A piece of knowledge is ready to capture only when one of these conditions is met:

- The user explicitly confirms an assumption or hypothesis ("yes that's correct", "that works", "confirmed").
- The user provides runtime evidence (logs, screenshots, test output) that validates the finding.
- The user states the intended behavior or design rationale directly.
- A fix or approach was applied and the user reports it works as intended.

If none of these apply, hold the insight internally — do not write it to a gen-kb-* file yet. You can ask the user to confirm before capturing.

## Instructions

1. When a verified insight emerges, identify the relevant domain (e.g., Unity UI Toolkit, esbuild, PuerTS, CSS pipeline).
2. Scan existing `.kiro/skills/gen-kb-*/SKILL.md` files for a matching skill.
   a. If one exists, append the entry to its body.
   b. If none fits, create a new one at `.kiro/skills/gen-kb-<topic>/SKILL.md`.
3. After writing, activate `selfimprove-dedupe-kb` on the modified file.

## Format for New gen-kb-* Skills

```yaml
---
name: gen-kb-<topic>
description: <One sentence describing the knowledge area and when it's relevant.>
---
```

Body entries:

```markdown
### <Short title>
<1-3 sentences of distilled, verified knowledge.>
```

## Rules

- Never log unverified assumptions, hypotheses, or speculative fixes.
- Each entry must be something a future reader couldn't easily guess — non-obvious, specific, and actionable.
- Keep entries to 1–3 sentences. Use exact type names, method names, config keys.
- Don't duplicate knowledge already present in a gen-kb-* skill.
- The `name` field must match the directory name. Lowercase, numbers, hyphens only.
- Keep gen-kb-* skill descriptions concise — they're loaded at startup.
- Prefer appending to existing skills over creating new ones when the topic overlaps.
