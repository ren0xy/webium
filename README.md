# Webium

A JS-first web rendering engine for game engines — run HTML, CSS, and JavaScript natively inside Unity, Godot, or any C# game engine through a shared TypeScript core, pluggable rendering backends, and a pluggable JS runtime.

## Status

**v0.0.1** — Architecture established. The core DOM, CSS pipeline, event system, layout, reconciliation, modding, and bridge protocol are implemented in TypeScript (`@webium/core`). C# is a thin bridge layer for render command execution, input event forwarding, and engine-specific integration. 356 JS tests + 77 C# tests passing.

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
│  ILifecycleDriver · ILayoutReadback              │
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
| `@webium/core` | TypeScript | Virtual DOM, CSS cascade/specificity/selectors, events (capture/target/bubble), Yoga layout, reconciliation engine, modding (manifest parser, CSS scoper, mod manager), render command + input event bridge protocol |
| `Webium.Core` | C# | Bridge interfaces (`IRenderCommandExecutor`, `IInputEventForwarder`, `ILifecycleDriver`, `ILayoutReadback`) and shared types (`RenderCommand`, `RenderOp`, `NodeSnapshot`) |
| `Webium.JSRuntime` | C# | Pluggable JS execution — PuerTS (desktop/mobile) and browser-native (WebGL) backends |
| `Webium.Unity.Runtime` | C# | Unity rendering backend — `UnityRenderCommandExecutor`, `UnityInputEventForwarder`, `UnityLayoutBridge`, `ReconciliationLoopBehaviour` |
| `Webium.Unity.Editor` | C# | Unity Editor tooling — DOM tree inspector, node detail drawer, search filter |

## Running Tests

```bash
# JS core tests
cd packages/core
npm test

# C# tests
dotnet test
```

## Vision & Roadmap

See [VISION.md](VISION.md) for the full project vision and architecture.
See [ROADMAP.md](ROADMAP.md) for milestone goals.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
