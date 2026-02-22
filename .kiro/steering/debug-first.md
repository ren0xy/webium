---
inclusion: always
---

# Debug-First Workflow

When investigating runtime bugs (especially Unity play-mode issues where I can't observe output directly):

1. **Start with debug logs** — don't guess. Add targeted `console.log` / `Debug.Log` statements at key decision points and have the user collect the output.
2. **Ask the user to report console output** before forming hypotheses about root causes.
3. **Keep logs prefixed** with `[Webium:Debug]` so they're easy to filter and remove later.
4. **Never remove debug logs on your own.** When you believe the issue is resolved, offer to end the debug session and remove the logs — but **wait for the user to explicitly confirm** before doing so. The user may still see problems you can't observe.

This avoids wasted cycles from speculative fixes that don't address the actual problem, and prevents premature cleanup that loses diagnostic visibility.
