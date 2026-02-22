# Webium

A JS-first web rendering engine for game engines — parse and render HTML, CSS, and JavaScript natively inside Unity, Godot, or any C# game engine through a shared TypeScript core, pluggable rendering backends, and a pluggable JS runtime.

## Status

**v0.2.0** — Dual backend support (UGUI + UIElements) with improved CSS rendering fidelity. Both backends render a functional hello-world example with accurate native text measurement, margin collapsing, font-family mapping, and generic CSS property application. The TypeScript core (`@webium/core`) owns the DOM, CSS pipeline, event system, layout, reconciliation, and bridge protocol. C# is a thin bridge layer with pluggable render backends selectable via `WebiumSurfaceConfig`.

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
│  ILifecycleDriver · ILayoutReadbackNew           │
│  ITextMeasurer · IWebiumRenderBackend            │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│           Engine Backends (C#)                   │
│  UGUI Backend · UIElements Backend · (future)    │
│  UGUI Backend · UIElements Backend · (future)    │
└─────────────────────────────────────────────────┘
```

er direction). This decouples core logic from any specific engine and makes multi-engine support straightforward.

## Packages

| Package | Language | Description |
| `Webium.Core` | C# | Bridge interfaces (`IRenderCommandExecutor`, `IInputEventForwarder`, `ILifecycleDriver`, `ILayoutReadbackNew`, `ITextMeasurer`, `IWebiumRenderBackend`) and shared types (`RenderCommand`, `RenderOp`, `RenderBackendType`) |
| `@webium/core` | TypeScript | HTML parser, browser API surface (`document`/`element`/`event`), virtual DOM, CSS cascade/specificity/selectors, events (capture/target/bubble), Yoga layout, reconciliation engine, modding (manifest parser, CSS scoper, mod manager), render command + input event bridge protocol |
| `Webium.Unity.Runtime` | C# | Unity rendering backends — UGUI (`UGUIRenderBackend`) and UIElements (`UIElementsRenderBackend`), `ReconciliationLoopBehaviour`, `UnityPuerTSRuntime` (real PuerTS runtime adapter), native text measurers |enderBackendType`) |
| `Webium.JSRuntime` | C# | `IJSRuntime`/`IJSBridge` interfaces and engine-agnostic stubs (`PuerTSRuntime` is a stub for the `dotnet test` pipeline) |
## Next Milestone

v0.3.0 — Interactivity & Richer CSS. More complex examples to expand CSS support (borders, border-radius, opacity, pseudo-classes) and add JS interactivity (button clicks with DOM mutations, text input fields, dynamic element creation/removal). See [ROADMAP.md](docs~/ROADMAP.md) for details.