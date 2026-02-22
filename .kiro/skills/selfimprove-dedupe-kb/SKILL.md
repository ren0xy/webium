---
name: selfimprove-dedupe-kb
description: Ensures gen-kb-* skills stay free of redundant, duplicate, or semantically overlapping entries. Activated after writing to any gen-kb-* skill.
---

# Deduplicate a gen-kb-* Skill

## When to Use

Activate after adding or modifying entries in a single `.kiro/skills/gen-kb-*/SKILL.md` file.

## Instructions

1. Read the gen-kb-* skill file that was just written to.
2. Compare every entry against every other entry within that same file:
   a. Exact or near-exact duplicates → delete the redundant one (keep the more precise version).
   b. Semantically overlapping entries (same lesson, different wording) → merge into one, keeping the clearest phrasing.
   c. Entries that are strict subsets of another → keep only the more complete one.
3. Verify each remaining entry is:
   - Meaningful: teaches something non-obvious.
   - Short: 1–3 sentences max, no filler.
   - Precise: uses exact type names, method names, or config keys — no vague references.
   - Concise: no redundant qualifiers, no restating the title in the body.

## Rules

- Only operate on the single gen-kb-* file that was just modified. Do not scan or touch other gen-kb-* files.
- Never merge entries that cover genuinely different gotchas, even if they share a theme.
- When two entries overlap partially, split the shared knowledge into one entry and keep the unique parts as separate entries.
- If an entry's entire value is already captured by the skill's description or another entry's title, delete it.
- Preserve the `### <Short title>` format — no other heading levels or metadata lines.
- Log what was removed or merged as a brief comment in your response so the user can review.
