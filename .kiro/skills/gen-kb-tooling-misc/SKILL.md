---
name: gen-kb-tooling-misc
description: Knowledge about Kiro steering files, PowerShell quirks, git workflows, and miscellaneous tooling tips.
---

### Steering file `inclusion: auto` is not a valid option
The valid `inclusion` front-matter values for `.kiro/steering/*.md` are `always`, `fileMatch` (with `fileMatchPattern`), and `manual`. Using `auto` silently fails — the steering file is never loaded.

### Join-Path 3-arg syntax requires PowerShell 6+
`Join-Path $a $b $c` (3+ arguments) only works in PowerShell 6+ (pwsh). Windows PowerShell 5.1 only supports 2 arguments. Chain calls instead: `Join-Path (Join-Path $a $b) $c`.

### `[System.IO.File]::WriteAllText` resolves relative paths from process CWD, not tool CWD
When using `[System.IO.File]::WriteAllText($relativePath, $content)` in PowerShell via the executePwsh tool, the relative path resolves from the actual PowerShell process working directory, not the `cwd` parameter. Always resolve to absolute paths first.

### Force-updating remote git tags requires delete-then-push
`git push origin v0.1.0` is rejected if the tag already exists on the remote. Use `git push origin :refs/tags/v0.1.0` to delete the remote tag first, then push the new one.

### Use `git reset --soft` to squash commits without interactive rebase
To squash all commits after a base into one without an interactive editor: `git reset --soft <base-commit>` then `git commit`. This stages all changes since the base as a single new commit.

### Deletion specs: grep after each file deletion, not just at the end
When deleting multiple files that reference each other, grep for stale references after each deletion to track which references remain and which are expected. This makes the final verification trivial and catches surprises early.

### ReadOnlySpan<byte> accepts byte[] via implicit conversion
C# methods taking `ReadOnlySpan<byte>` accept `byte[]` directly via implicit conversion. No explicit cast or `.AsSpan()` call is needed.
