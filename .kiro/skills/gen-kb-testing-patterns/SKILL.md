---
name: gen-kb-testing-patterns
description: Knowledge about test setup patterns, Vitest API quirks, Unity test infrastructure, and general testing strategies.
---

### `createXDeps()` helper pattern for isolated test setup
When testing a module with multiple collaborating objects, create a `createXDeps()` factory helper that returns fresh instances of all dependencies. This avoids repetitive setup across tests and keeps each test isolated.

### Vitest spy API: use `spy.mock.calls`, not `spy.calls`
Vitest spies created with `vi.spyOn()` expose call data at `spy.mock.calls`, not `spy.calls`. Accessing `spy.calls` returns `undefined`. Always use `spy.mock.calls.length` and `spy.mock.calls[i][0]`.

### VirtualDOM root node has tag NodeTag.Div — avoid `div` selectors in querySelector tests
The VirtualDOM root node has `tag === 0` which equals `NodeTag.Div`. When testing `querySelector("div")` or `querySelectorAll("div")`, the root node will match unexpectedly. Use `span` or other non-div tags in selector tests.

### Unity test asmdef `overrideReferences` blocks access to project DLLs
When a Unity test `.asmdef` has `overrideReferences: true`, only explicitly listed `precompiledReferences` are available. If a test needs types from another assembly, add that DLL to the `precompiledReferences` array.

### Testing MonoBehaviour.Awake() — exploit creation order before factory throws
`MonoBehaviour.Awake()` methods that create structures before calling a factory that throws in test environments can still be unit tested. Catch the exception in SetUp and verify the structures created before the failure point.

### Make internal fields `internal static readonly` for Unity property test access
When a renderer has data tables that property tests need to verify, make the field `internal static readonly` rather than `private`. Unity test assemblies reference the runtime assembly via asmdef, so `internal` members are accessible without `InternalsVisibleTo`.

### Creating .csproj for Unity asmdef test projects with pure .NET code
When a Unity test project (`.asmdef`) contains tests for pure .NET code (no Unity engine deps), create a parallel `.csproj` that links source files via `<Compile Include="..." Link="..." />` and excludes Unity-dependent test files. This enables `dotnet test` without requiring the Unity test runner.

### Unity-dependent tests stay excluded from .csproj — use Unity Test Runner
Tests that reference Unity types (`GameObject`, `RectTransform`, `MonoBehaviour`) must remain excluded from the `.csproj`. They run via Unity Test Runner, not `dotnet test`.
