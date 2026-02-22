---
name: escalate-to-spec
description: Detects when a task hits a major complexity blocker, architectural misalignment, or scope explosion that cannot be resolved within the current session. Offers to create a dedicated spec with full context so work can continue cleanly in a new session.
---

# Escalate Blocker to Dedicated Spec

## When to Activate

Activate this skill when you encounter ANY of the following during a task (whether inside a spec or in free-form chat):

1. **Architectural misalignment** — the current code structure fundamentally doesn't support what's being asked. A fix would require reshaping abstractions, moving responsibilities between modules, or changing data flow across multiple layers.
2. **Scope explosion** — what seemed like a small change turns out to require coordinated modifications across 4+ files in different subsystems, or introduces a dependency chain that cascades beyond the original intent.
3. **Design gap** — the feature requires a design decision that hasn't been made yet (e.g., choosing between two competing patterns, defining a new public API surface, or resolving a conflict between existing conventions).
4. **Deep prerequisite chain** — the task depends on something that doesn't exist yet and building that prerequisite is itself non-trivial (e.g., "we need a caching layer before we can optimize this" or "the test infrastructure doesn't support this scenario").
5. **Risk of destabilization** — the change touches a critical path and the blast radius is large enough that it warrants its own focused effort with proper validation tasks.

## What NOT to Escalate

- Simple bugs that just need more debugging time.
- Tasks that are tedious but straightforward (many files, but each change is mechanical).
- Missing knowledge that can be resolved by reading code or asking the user a question.
- Performance optimizations that are localized to one function or module.

## Instructions

When you detect a blocker that qualifies:

### Step 1: Tell the User

Explain concisely:
- What you were trying to do.
- What blocker you hit and why it's not a quick fix.
- Why it deserves its own spec (scope, risk, or architectural impact).

Then ask: **"Want me to create a dedicated spec for this so it can be tackled properly?"**

Do NOT create the spec without explicit user confirmation.

### Step 2: Create the Spec (only after user agrees)

1. Determine the next spec number by scanning `.kiro/specs/` for the highest existing numeric prefix and incrementing by 1. Follow the `spec-naming` skill convention (`NNN-kebab-description`).

2. Create `requirements.md` in the new spec folder with:
   - **Goal**: What needs to be achieved (the blocker resolution).
   - **Context / Origin**: A brief summary of where this blocker surfaced — which session, spec, or user request led here, and the specific point where things went off the rails.
   - **Requirements**: Concrete, testable requirements for resolving the blocker. Use the same `ID: description` format as existing specs.
   - **Continuation Notes**: If the user was in the middle of something when the blocker was hit, describe what they were doing and how to resume after this spec is completed. Reference specific files, functions, or task numbers.

3. Create `original_context_dump.md` in the same spec folder. This is a comprehensive brain-dump of everything the agent knows at the point of escalation, so a future session can pick up without re-discovering context. Include ALL of the following that are relevant:
   - **Original Request**: The user's original message/goal that started the session.
   - **Work Done So Far**: Every file created, modified, or deleted during this session. Include what was changed and why.
   - **Approaches Tried**: What was attempted, what worked, what didn't, and why each failed approach was abandoned.
   - **Current State of the Code**: Describe the state things are in right now — is anything half-finished, temporarily broken, or in a dirty state that needs cleanup?
   - **Key Observations**: Anything discovered during the session that isn't obvious from reading the code — runtime behavior, implicit dependencies, ordering constraints, undocumented quirks.
   - **Hypotheses**: Any theories about root causes or solutions that haven't been validated yet. Mark them clearly as unverified.
   - **Relevant Files**: List every file that a future session should read to understand the problem space. Include brief notes on why each file matters.
   - **Dependencies & Interactions**: How the affected components relate to each other — call chains, data flow, event sequences, shared state.
   - **What Was NOT Investigated**: Explicitly note areas that might be relevant but weren't explored, so the next session knows where the blind spots are.

4. Do NOT create `design.md`, `tasks.md`, or `worklog.md`. The user will drive design and task breakdown manually through the normal spec workflow.

### Step 3: Report Back

After creating the spec, tell the user:
- The spec folder path.
- A one-sentence summary of what it covers.
- Whether you can continue with the original work (with a workaround or partial solution) or if the blocker is hard and the original task should be paused.

## Format Reference

Follow the conventions established in existing specs under `.kiro/specs/`. Requirements use short IDs (e.g., `SCR-1`, `BLK-1`). Tasks reference requirements and design sections. See `spec-naming` skill for folder naming rules.
