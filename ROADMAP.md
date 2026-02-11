# Webium - Roadmap

## v0.0.1 - JS Core Architecture (current)

Architecture established with JS-first core. `@webium/core` TypeScript package owns DOM, CSS pipeline, events, layout, reconciliation, and modding. C# reduced to thin bridge layer (render command execution, input event forwarding, engine-specific integration). Unity backend migrated to consume render commands. 356 JS tests + 77 C# tests passing.

What's in place:
- Virtual DOM with node pool, dirty queue, and cycle detection
- Full CSS pipeline: css-tree parsing, selector matching (compound selectors + combinators), specificity, cascade, inheritance, computed style resolution
- Event system with capture/target/bubble phases, stopPropagation, stopImmediatePropagation
- Layout via yoga-layout WASM
- Reconciliation engine: dirty queue -> style resolve -> layout -> RenderCommandBuffer
- Render command protocol with typed array and JSON serialization
- Input event protocol for pointer and focus events
- Modding system: manifest parser, CSS scoper (with idempotent scoping), mod manager
- Unity backend: UnityRenderCommandExecutor, UnityInputEventForwarder, UnityLayoutBridge
- Property-based tests via fast-check for all core correctness properties

## v0.1.0 - Browser API Surface

Expose faithful browser-compatible APIs (`window`, `document`, `Element`, `CSSStyleDeclaration`, `Event`) as JS objects backed by `@webium/core`. Target: standard JS libraries (React, Vue) work unmodified via `react-dom`.

## v0.2.0 - Developer Tooling

CSS hot-reload, DOM inspector overlay, performance profiler, mod development CLI.

## v0.3.0 - Multi-Engine

Godot backend implementation. Validate the four-interface bridge contract works cleanly across engines.

## v1.0.0 - Production Ready

Performance optimization, CSS Grid support, comprehensive documentation, stable public API.

---

See [VISION.md](VISION.md) for the full project vision and architecture.