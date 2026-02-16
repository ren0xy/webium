---
inclusion: fileMatch
fileMatchPattern: "src/Webium.Core/**,src/Webium.JSRuntime/**"
---

# Engine-Agnostic Layer Rules

`src/Webium.Core` and `src/Webium.JSRuntime` are engine-agnostic assemblies. They must compile and run without any game engine SDK installed.

## Forbidden References

The following namespaces and packages must NEVER appear in these two projects:

- `UnityEngine`, `UnityEditor` (Unity)
- `Puerts` (PuerTS — Unity-specific JS bridge)
- `Godot` (Godot engine)
- Any other engine-specific namespace

This includes `using` directives, fully-qualified type references, and conditional compilation blocks that assume a specific engine.

## How to Add Engine-Specific Behavior

Engine-specific functionality is injected via the runtime layer:

- `src/Webium.Unity.Runtime` — Unity-specific implementations (PuerTS, UnityEngine, etc.)
- Future: `src/Webium.Godot.Runtime` — Godot-specific implementations

These runtime projects implement interfaces defined in `Webium.Core` or `Webium.JSRuntime` (e.g., `IJSRuntime`, `IRenderCommandExecutor`).

## Examples

- Need `Debug.Log`? → Use an `ILogger` interface in Core, implement it in Unity.Runtime.
- Need PuerTS `JsEnv`? → `IJSRuntime` is in JSRuntime; `UnityPuerTSRuntime` (which wraps `JsEnv`) is in Unity.Runtime.
- Need `GameObject`? → `IRenderCommandExecutor` is in Core; `UnityRenderCommandExecutor` is in Unity.Runtime.
