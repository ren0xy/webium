---
name: selfimprove-worklog
description: Maintains a worklog.md in the current spec folder. Triggered after each individual task in a .kiro/specs/*/tasks.md file is completed. Logs what was done, files touched, roadblocks, and architectural decisions.
---

# Update Spec Worklog

## When to Use

This skill triggers after each individual task from a `.kiro/specs/*/tasks.md` file is marked complete. It runs once per task, not once per spec.

## Instructions

1. Identify the spec folder for the task just completed.
2. If `worklog.md` doesn't exist in that spec folder, create it.
3. Append a single entry for the completed task using this format:

```markdown
## Task N: <short description>
- Done: <what was accomplished>
- Files: <files created/modified>

### Roadblock: <short title> (if any)
- Problem: <what went wrong>
- Tried: <what didn't work>
- Solution: <what worked and why>

### Decision: <short title> (if any)
- Context: <why a decision was needed>
- Chosen: <what was decided>
- Alternatives: <what was considered but rejected, and why>
```

4. Keep entries terse and factual. No fluff, no timestamps.
5. Only include Roadblock sections if one was actually encountered and resolved.
6. Only include Decision sections if a notable choice was made. Examples:
   - Architectural decisions (patterns, abstractions, module boundaries)
   - Configuration choices (tool settings, build options, runtime flags)
   - Dependency choices (library selection, version pinning)
   - API design decisions (naming, signatures, contracts)
   - Trade-offs (performance vs readability, flexibility vs simplicity)
7. Skip trivial or obvious decisions. Log only what a future reader would find valuable.
