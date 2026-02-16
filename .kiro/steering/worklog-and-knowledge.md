---
inclusion: always
description: Guides worklog maintenance during spec implementation and ensures accumulated knowledge is always in context.
---

# Worklog & Knowledge System

## Worklog During Spec Implementation

When working on spec tasks (implementing items from a `tasks.md`), maintain a `worklog.md` file in the same spec folder.

### Worklog Rules

- Create `worklog.md` in the spec folder when starting the first task if it doesn't exist.
- After completing each task, append a short factual entry: what was done, what files were touched.
- When a roadblock is encountered and resolved, document it immediately:
  - What the problem was
  - What approaches were tried (and failed)
  - What finally worked and why
- Keep entries terse. No fluff. Timestamps are not needed, task references are.
- Format:

```markdown
## Task N: <short description>
- Done: <what was accomplished>
- Files: <files created/modified>

### Roadblock: <short title> (if any)
- Problem: <what went wrong>
- Tried: <what didn't work>
- Solution: <what worked and why>
```

## Post-Spec Reflection

When a spec is fully complete (all tasks done), or when the user triggers the "Reflect on Worklog" hook:

1. Read the spec's `worklog.md` in full.
2. Extract reusable knowledge: patterns, gotchas, tool quirks, syntax traps, approach preferences.
3. Append distilled entries to `.kiro/docs/knowledgebase.md` (create if missing).
4. Each entry should be tagged with the spec it came from and categorized (e.g., `[tooling]`, `[powershell]`, `[file-ops]`, `[testing]`, `[syntax]`).
5. Do NOT duplicate knowledge that already exists in the knowledgebase.

## Knowledgebase Format

```markdown
### <Short title> [category]
Source: spec NNN
<1-3 sentences of distilled knowledge>
```

## Ad-Hoc Knowledge Capture

Not all useful lessons come from spec work. When a session involves debugging, fixing configuration, discovering tool quirks, or resolving environment issues — even outside of any spec — distill the lesson and append it to `.kiro/docs/knowledgebase.md`.

### Rules for Ad-Hoc Entries

- Use source `ad-hoc session (<short context>)` instead of a spec number.
- Same format and deduplication rules as post-spec reflection entries.
- Capture it before the session ends. Don't wait for a spec to exist.

## Always Load Knowledge

The knowledgebase at `.kiro/docs/knowledgebase.md` contains hard-won lessons from previous spec work. Reference it when:
- Choosing between approaches for file operations, shell commands, or syntax
- Encountering errors that seem environment-specific
- Making decisions about tooling or patterns

#[[file:.kiro/docs/knowledgebase.md]]
