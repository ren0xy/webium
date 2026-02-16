# Knowledgebase

Accumulated lessons from project development. Each entry is tagged with a source context and category.

---

### Steering file `inclusion: auto` is not a valid option [tooling]
Source: ad-hoc session (steering fix)
The valid `inclusion` front-matter values for `.kiro/steering/*.md` are `always`, `fileMatch` (with `fileMatchPattern`), and `manual`. Using `auto` silently fails — the steering file is never loaded.

### fast-check v4 missing APIs — use `fc.stringMatching` as workaround [testing]
Source: HTML parser implementation
`fc.stringOf(charArb)`, `fc.fullUnicode()`, and `fc.fullUnicodeString()` are not available in fast-check v4.5.3. To generate strings from a constrained character set or broad Unicode range, use `fc.stringMatching(/^[charset]{min,max}$/)` or `fc.stringMatching(/^[\s\S]{0,N}$/)`.

### htmlparser2 follows HTML spec implicit tag closing rules [testing]
Source: HTML parser implementation
When writing property-based tests for HTML tree structure, only `div` and `span` allow truly arbitrary nesting. Tags like `li`, `p`, `h1`-`h6`, `button`, and `a` have implicit closing behavior in htmlparser2 (e.g., `<li>` auto-closes a preceding `<li>`, `<p>` can't contain block elements). Restrict PBT generators to `div`/`span` for nesting tests.

### `createXDeps()` helper pattern for isolated test setup [testing]
Source: HTML parser, CSS file loading, and browser API implementations
When testing a module with multiple collaborating objects, create a `createXDeps()` factory helper that returns fresh instances of all dependencies. This avoids repetitive setup across tests and keeps each test isolated. Examples: `createParserDeps()`, `createLoaderDeps()`, `createAPIDeps()`.

### Vitest spy API: use `spy.mock.calls`, not `spy.calls` [testing]
Source: CSS file loading implementation
Vitest spies created with `vi.spyOn()` expose call data at `spy.mock.calls`, not `spy.calls`. Accessing `spy.calls` returns `undefined`. Always use `spy.mock.calls.length` and `spy.mock.calls[i][0]` to inspect spy invocations.

### VirtualDOM root node has tag NodeTag.Div (tag 0) — avoid `div` selectors in querySelector tests [testing]
Source: browser API surface implementation
The VirtualDOM root node has `tag === 0` which equals `NodeTag.Div`. When testing `querySelector("div")` or `querySelectorAll("div")`, the root node will match unexpectedly. Use `span` or other non-div tags in selector tests to avoid root interference.

### PBT generators with Map keys must ensure uniqueness across generated items [testing]
Source: browser API surface implementation
When building a `Map<string, T>` from PBT-generated data, duplicate keys cause silent overwrites. Prefix keys with the array index to guarantee uniqueness regardless of generator output.

### `fc.letrec` for recursive HTML fragment generation in PBTs [testing]
Source: browser API surface implementation
Use `fc.letrec` with a `depthIdentifier` to generate recursive HTML structures for innerHTML round-trip tests. Define `tree`, `text`, and `element` ties where `element` wraps children in `<div>` or `<span>` tags. This produces well-formed fragments that survive htmlparser2 round-tripping.

### `fc.RecordValue` requires 2 type arguments in fast-check v4 [testing]
Source: browser API surface implementation
`fc.RecordValue<typeof arb>` fails with "Generic type 'RecordValue' requires 2 type argument(s)" in fast-check v4. Use an explicit union type for the generated record shape instead.

### Unity test asmdef `overrideReferences` blocks access to project DLLs [testing]
Source: event round trip implementation
When a Unity test `.asmdef` has `overrideReferences: true`, only explicitly listed `precompiledReferences` are available. If a test needs types from another assembly, add that DLL to the `precompiledReferences` array.

### E2E property tests need to drain initial dirty nodes before assertions [testing]
Source: event round trip implementation
When testing end-to-end flows involving reconciliation engines, newly created nodes start dirty. Call `tick()` once and clear the output buffer before the actual test to avoid initial creation commands polluting assertions about event-driven mutations.

### Testing MonoBehaviour.Awake() — exploit creation order before factory throws [testing]
Source: Unity visual realization implementation
`MonoBehaviour.Awake()` methods that create structures before calling a factory that throws in test environments can still be unit tested. Catch the exception in SetUp and verify the structures created before the failure point. This pattern works for any MonoBehaviour where early setup is testable but later initialization depends on unavailable runtime services.

### Make internal fields `internal static readonly` for Unity property test access [testing]
Source: Unity visual realization implementation
When a renderer has data tables that property tests need to verify, make the field `internal static readonly` rather than `private`. Unity test assemblies reference the runtime assembly via asmdef, so `internal` members are accessible without `InternalsVisibleTo`.

### FsCheck `Prop.ForAll` accepts at most 6 arbitraries [testing]
Source: hello world integration implementation
FsCheck 2.x `Prop.ForAll` overloads max out at 6 type parameters. When a property test needs more inputs, combine multiple generators into a single `Arbitrary<T>` using LINQ query syntax and call `gen.ToArbitrary()`.

### Creating .csproj for Unity asmdef test projects with pure .NET code [testing]
Source: hello world integration implementation
When a Unity test project (`.asmdef`) contains tests for pure .NET code (no Unity engine deps), create a parallel `.csproj` that links source files via `<Compile Include="..." Link="..." />` and excludes Unity-dependent test files. This enables `dotnet test` without requiring the Unity test runner.

### ReadOnlySpan<byte> accepts byte[] via implicit conversion [syntax]
Source: hello world integration implementation
C# methods taking `ReadOnlySpan<byte>` accept `byte[]` directly via implicit conversion. No explicit cast or `.AsSpan()` call is needed.

### Unity-dependent tests stay excluded from .csproj — use Unity Test Runner [testing]
Source: layout cleanup implementation
Tests that reference Unity types (`GameObject`, `RectTransform`, `MonoBehaviour`) must remain excluded from the `.csproj`. They run via Unity Test Runner, not `dotnet test`.

### Deletion specs: grep after each file deletion, not just at the end [file-ops]
Source: layout cleanup implementation
When deleting multiple files that reference each other, grep for stale references after each deletion to track which references remain and which are expected. This makes the final verification trivial and catches surprises early.

### esbuild IIFE format incompatible with top-level await — use ESM + post-process wrapper [tooling]
Source: hello world E2E implementation
esbuild hard-refuses `format: "iife"` when the bundle contains top-level `await`. The `supported: { "top-level-await": true }` flag does not override this. Workaround: build as ESM, then post-process to strip `export {}` and wrap in `(async function() { ... })();`.

### Join-Path 3-arg syntax requires PowerShell 6+ [powershell]
Source: expanded node tags implementation
`Join-Path $a $b $c` (3+ arguments) only works in PowerShell 6+ (pwsh). Windows PowerShell 5.1 only supports 2 arguments. Chain calls instead: `Join-Path (Join-Path $a $b) $c`.

### Unity DLL .meta files need PluginImporter section [unity]
Source: expanded node tags implementation
A minimal `.meta` file (just `fileFormatVersion` + `guid`) is not enough for Unity to recognize a DLL as a plugin. The `.meta` must include a `PluginImporter` section with `isExplicitlyReferenced: 1` and `platformData` entries.

### Prefer asmdefs over precompiled DLLs for pure C# projects [architecture]
Source: expanded node tags implementation
If a C# project targets netstandard2.1 with zero NuGet dependencies, create an asmdef with `noEngineReferences: true` instead of precompiling to DLL. This eliminates the Plugins folder, DLL build/copy steps, and fragile PluginImporter .meta files.

### InternalsVisibleTo must match asmdef name, not csproj assembly name [unity]
Source: expanded node tags implementation
When converting from csproj to asmdef compilation, `InternalsVisibleTo` attributes must reference the asmdef `name` field (e.g., `"webium.jsruntime"`) not the csproj assembly name (e.g., `"Webium.JSRuntime"`). Unity names compiled assemblies after the asmdef name.

### Delete bin.meta and obj.meta to prevent Unity scanning dotnet build artifacts [unity]
Source: expanded node tags implementation
If a folder inside a UPM package has a `.meta` file, Unity will scan it. `bin/` and `obj/` folders from `dotnet build` contain .NET assemblies that conflict with Unity's compilation. Delete `bin.meta` and `obj.meta` files, and ensure `bin/` and `obj/` are in `.gitignore`.

### dotnet build obj/ folder causes duplicate attribute errors when inside Unity asmdef tree [unity]
Source: expanded node tags implementation
When a `.csproj` lives inside an asmdef folder, `dotnet build` generates `obj/<config>/<tfm>/<AssemblyName>.AssemblyInfo.cs` with assembly attributes that conflict with Unity's own auto-generated attributes. Delete `bin/` and `obj/` before opening Unity, or configure `<BaseOutputPath>` to output outside the asmdef folder tree.

### Precompiled DLLs mask stale source code — asmdef compilation exposes it [architecture]
Source: expanded node tags implementation
When switching from precompiled DLLs to asmdef-based compilation, expect a cascade of stale code errors. The old DLL contained types that no longer exist in source. Files that compiled against the DLL will fail against source. Check all assemblies — not just the one being migrated.

### PackageInfo is ambiguous between UnityEditor.PackageManager and UnityEditor [unity]
Source: expanded node tags implementation
`using UnityEditor.PackageManager;` imports `PackageInfo` which conflicts with the deprecated `UnityEditor.PackageInfo`. Always fully qualify as `UnityEditor.PackageManager.PackageInfo.FindForAssembly(...)` to avoid CS0104.

### esbuild `external: ["module"]` leaks ESM imports into PuerTS-incompatible bundles [tooling]
Source: ad-hoc session (hello-world runtime fix)
When css-tree uses `createRequire(import.meta.url)` to load JSON at runtime, externalizing `"module"` preserves bare `import` statements in the bundle that PuerTS/V8 can't evaluate. Fix: use an esbuild plugin that intercepts `import "module"` and returns a shim with `createRequire()` backed by a pre-loaded JSON lookup map built at bundle time.

### `import.meta.url` must be replaced in PuerTS bundles [tooling]
Source: ad-hoc session (hello-world runtime fix)
yoga-layout's WASM loader references `import.meta.url` for `_scriptDir`. In PuerTS/V8 eval context, `import.meta` doesn't exist. Post-process the bundle with `.replace(/\bimport\.meta\.url\b/g, '"file:///webium-bundle"')`.

### Top-level await in bundled yoga-layout blocks synchronous PuerTS evaluation [architecture]
Source: ad-hoc session (hello-world runtime fix)
`import Yoga from "yoga-layout"` triggers a top-level `await` for WASM init. When the bundle is wrapped in an async IIFE for PuerTS, `Evaluate()` returns before the IIFE completes, so `globalThis` functions assigned inside it aren't available when C# calls `CallFunction()` immediately after. Fix: use dynamic `import()` for yoga-layout and assign `globalThis` functions synchronously.

### PuerTS V8 lacks `atob`/`btoa` — polyfill needed for `entities` library [tooling]
Source: ad-hoc session (hello-world runtime fix)
PuerTS V8 doesn't provide browser globals like `atob`/`btoa`. The `entities` library (used by htmlparser2) calls `atob()` at module init to decode base64 entity tables. Fix: inject an `atob` polyfill via esbuild's `banner` option so it's available before any module code runs.

### PuerTS `Eval<object>` returns `Puerts.ArrayBuffer` for JS typed arrays — use `.Bytes` property [tooling]
Source: ad-hoc session (hello-world runtime fix)
PuerTS marshals JS `Uint8Array` and `ArrayBuffer` as `Puerts.ArrayBuffer` on the C# side, not `byte[]`. `Eval<byte[]>` returns null. The correct approach: `Eval<object>`, check `result is Puerts.ArrayBuffer ab`, then read `ab.Bytes` to get the `byte[]`.

### Use Directory.Build.props to redirect dotnet build output to bin~/obj~ [tooling]
Source: ad-hoc session (dotnet test cleanup)
Unity ignores folders ending with `~`. Place a `Directory.Build.props` in `src/` that sets `BaseOutputPath` to `bin~`, `BaseIntermediateOutputPath` to `obj~`, and `MSBuildProjectExtensionsPath` to match. This must be in `Directory.Build.props` (not csproj) because `BaseIntermediateOutputPath` must be set before `Microsoft.Common.props` is imported.

### PuerTS V8 lacks TextEncoder/TextDecoder — polyfill needed for binary serialization [tooling]
Source: ad-hoc session (hello-world runtime fix)
PuerTS V8 doesn't provide `TextEncoder` or `TextDecoder` (Web APIs). Fix: inject UTF-8 polyfills via esbuild's `banner` option alongside the existing `atob` polyfill.
