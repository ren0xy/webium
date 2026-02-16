# Webium

A JS-first web rendering engine for game engines — parse and render HTML, CSS, and JavaScript natively inside Unity, Godot, or any C# game engine through a shared TypeScript core, pluggable rendering backends, and a pluggable JS runtime.

## Status

**v0.1.0** — Hello world with HTML/CSS/JS rendering as native Unity GameObjects. A Unity project designates a folder containing HTML, CSS, and JS files; pressing Play renders a fully interactive UI as native GameObjects with text rendering (TextMeshPro) and click event handling. The TypeScript core (`@webium/core`) owns the DOM, CSS pipeline, event system, layout, reconciliation, and bridge protocol. C# is a thin bridge layer for render command execution, input event forwarding, and engine-specific integration. 573 JS tests + 153 C# tests passing.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              @webium/core (TypeScript)           │
│  VirtualDOM · CSS Pipeline · Events · Layout    │
│  Reconciliation · Modding · Bridge Protocol     │
└──────────────────────┬──────────────────────────┘
                       │ RenderCommand / InputEvent
┌──────────────────────▼──────────────────────────┐
│              C# Bridge Layer                     │
│  IRenderCommandExecutor · IInputEventForwarder   │
│  ILifecycleDriver · ILayoutReadbackNew            │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│           Engine Backends (C#)                   │
│  Unity Runtime · Unity Editor · (future engines) │
└─────────────────────────────────────────────────┘
```

The RenderCommandBuffer is the only data crossing the JS↔native boundary per frame (plus InputEvents going the other direction). This decouples core logic from any specific engine and makes multi-engine support straightforward.

## Packages

| Package | Language | Description |
|---|---|---|
| `@webium/core` | TypeScript | HTML parser, browser API surface (`document`/`element`/`event`), virtual DOM, CSS cascade/specificity/selectors, events (capture/target/bubble), Yoga layout, reconciliation engine, modding (manifest parser, CSS scoper, mod manager), render command + input event bridge protocol |
| `Webium.Core` | C# | Bridge interfaces (`IRenderCommandExecutor`, `IInputEventForwarder`, `ILifecycleDriver`, `ILayoutReadbackNew`) and shared types (`RenderCommand`, `RenderOp`, `NodeSnapshot`) |
| `Webium.JSRuntime` | C# | `IJSRuntime`/`IJSBridge` interfaces and engine-agnostic stubs (`PuerTSRuntime` is a stub for the `dotnet test` pipeline) |
| `Webium.Unity.Runtime` | C# | Unity rendering backend — `UnityRenderCommandExecutor`, `UnityInputEventForwarder`, `UnityLayoutBridge`, `ReconciliationLoopBehaviour`, and `UnityPuerTSRuntime` (real PuerTS runtime adapter) |
| `Webium.Unity.Editor` | C# | Unity Editor tooling — DOM tree inspector, node detail drawer, search filter |

## Dependencies

For Unity consumers, the following must be installed in the Unity project:

- **PuerTS** (`com.tencent.puerts.core`) — required for JS execution on desktop/mobile platforms. Install via UPM git URL or OpenUPM. Not needed for WebGL builds (browser JS engine is used instead).

## Installation

### Via local path (for development)

Add to your Unity project's `Packages/manifest.json`:

```json
"dependencies": {
  "com.webium.core": "file:../webium"
}
```

Adjust the path relative to your `Packages/` folder.

### Via git URL

```json
"dependencies": {
  "com.webium.core": "https://github.com/ren0xy/webium.git"
}
```

### Required: OpenUPM scoped registry

Webium depends on PuerTS, which is hosted on OpenUPM. Add this to your `manifest.json`:

```json
"scopedRegistries": [
  {
    "name": "OpenUPM",
    "url": "https://package.openupm.com",
    "scopes": ["com.tencent.puerts"]
  }
]
```

### Auto-resolved dependencies

These are declared in Webium's `package.json` and resolved automatically by UPM:

- `com.tencent.puerts.core` 2.1.0
- `com.unity.textmeshpro` 3.0.6
- `com.unity.ugui` 2.0.0

## Running Tests

```bash
# JS core tests
cd packages/core
npm test

# C# tests
dotnet test
```

## Next Milestone

v0.2.0 — Richer Rendering & CSS. Expand rendering fidelity beyond the hello world baseline: richer CSS properties (borders, margins, overflow, opacity), pseudo-classes (`:hover`, `:active`, `:focus`), more HTML elements (form inputs, images with asset loading), flexbox completeness, scroll containers, and improved text rendering. See [ROADMAP.md](docs/ROADMAP.md) for details.

## Vision

See [VISION.md](docs/VISION.md) for the full project vision and architecture.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
