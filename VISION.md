# Webium — Vision

> A JS-first web rendering engine for game engines — run HTML, CSS, and JavaScript natively inside any C# game engine through a shared TypeScript core, pluggable rendering backends, and a pluggable JS runtime.

## Problem

Game engine UI systems are painful. Unity's UGUI is powerful but tedious for complex interfaces. UI Toolkit (UXML/USS) invented yet another markup/styling dialect instead of using the ones millions of developers already know. Godot's Control nodes work but lack the expressiveness and tooling maturity of the web platform. Every engine reinvents the wheel.

Meanwhile, web UI development has decades of mature tooling, frameworks, and developer knowledge. There's no good reason game developers should learn proprietary UI systems when HTML/CSS/JS already solves 2D UI comprehensively.

There's also no viable path today for runtime UI modding in most game engines. Games like World of Warcraft proved that exposing a web-like UI layer to modders creates thriving addon ecosystems. Most engines have nothing equivalent.

## Vision

Webium is a game-engine-agnostic web UI engine with a JS-first core. A shared TypeScript package (`@webium/core`) owns the virtual DOM, CSS pipeline, event dispatch, layout (via yoga-layout WASM), reconciliation, modding, and render command generation. The native side (Unity, Unreal, Godot) is reduced to a thin bridge that executes render commands and forwards input events.

The key architectural insight: the **RenderCommandBuffer is the only data that crosses the JS↔native boundary per frame** (plus InputEvents going the other direction). This decouples the core logic from any specific engine and makes multi-engine support trivial — each engine only needs to implement four small interfaces.

From JavaScript's perspective, it's running in a real web browser. From the engine's perspective, it's just native scene objects.

## Target Audience

- **Game developers** who already know HTML/CSS and are tired of engine-specific UI boilerplate.
- **Web developers** entering game development who want to use familiar tools and frameworks.
- **Game studios** that want to enable runtime UI modding (addon systems, custom HUDs, player-created interfaces).
- **Modders** who can write HTML/CSS/JS and want to create UI addons without learning engine internals.
- **Engine-agnostic developers** who want a web UI layer that works across Unity, Godot, or any engine without rewriting the UI system per engine.

## Goals

- Translate HTML/CSS into native engine visuals at runtime.
- Implement browser DOM/CSS/Style APIs faithfully enough that standard JS libraries (React, Vue, etc.) work unmodified via `react-dom`.
- JavaScript owns the DOM, CSS, events, layout, and reconciliation — C# only executes render commands.
- Enable runtime UI modding: games expose a Webium surface where players load HTML/CSS/JS addons with sandboxed CSS scoping.
- Feel like building a webpage. No new languages, no new tooling.
- Keep the engine bridge minimal: four interfaces, under 1000 lines per engine.

## Non-Goals

- Not a web browser. No networking, no navigation, no URL bar, no tabs.
- No WebGL canvas, Canvas 2D, SVG, or video/audio playback.
- No HTTP requests or fetch API (games can expose their own data APIs to JS separately).
- Not targeting pixel-perfect parity with Chrome — targeting "close enough that real apps work and look right."

## Architecture

### Repository Structure

```
packages/
  core/                          # @webium/core — shared TypeScript core
    src/
      dom/                       # VirtualNode, VirtualDOM, NodePool, DirtyQueue
      css/                       # SelectorMatcher, Specificity, CascadeResolver,
                                 #   ComputedStyleResolver, StyleInheritance, StyleSheetManager
      events/                    # EventDispatcher, EventListenerStore, DOMEvent
      layout/                    # YogaLayoutEngine (yoga-layout WASM)
      reconciliation/            # ReconciliationEngine (tick → RenderCommandBuffer)
      modding/                   # ManifestParser, CSSScoper, ModManager
      bridge/                    # RenderCommand types, InputEvent types, serialization
    tests/                       # 356 tests (vitest + fast-check property tests)

src/
  Webium.Core/                   # Bridge interfaces + shared types (C#)
  Webium.JSRuntime/              # Pluggable JS execution (PuerTS, browser-native)
  Webium.Unity.Runtime/          # Unity rendering backend
  Webium.Unity.Editor/           # Unity Editor tooling
```

### Data Flow Per Frame

```
1. User/mod scripts call DOM APIs → mutate VirtualNodes → enqueue into DirtyQueue
2. Lifecycle driver calls tick() from engine frame loop
3. ReconciliationEngine drains DirtyQueue → CSS pipeline → yoga-layout → RenderCommandBuffer
4. RenderCommandBuffer serialized (typed arrays or JSON) → sent to native side
5. Render Command Executor translates each command to engine-native operations
6. Input events flow the other direction: engine input → InputEventForwarder → JS EventDispatcher
```

### Native Bridge Interface

Each engine implements four components:

| Interface | Responsibility |
|---|---|
| `IRenderCommandExecutor` | Receives RenderCommandBuffer, translates to engine-native scene operations |
| `IInputEventForwarder` | Captures engine input, hit-tests for target nodeId, forwards to JS |
| `ILifecycleDriver` | Calls JS tick() from engine frame loop, feeds result to executor |
| `ILayoutReadback` | Provides engine-native layout values for synchronous JS queries |

### Two-Sided Design

**JS side (`@webium/core`):**
Owns the VirtualDOM tree, CSS pipeline (css-tree parsing, selector matching, specificity, cascade, inheritance), event dispatch (capture/target/bubble with stopPropagation), layout (yoga-layout WASM), reconciliation (dirty queue → style resolve → layout → render commands), and modding (manifest parsing, CSS scoping, mod lifecycle).

**C# side (thin bridge):**
Receives a flat RenderCommandBuffer each frame and translates commands (Create, Destroy, UpdateLayout, UpdateStyle, UpdateText, Reparent) to engine-native operations. Forwards engine input events to JS as InputEvents. No DOM, CSS, or event logic.

### JS Runtime Backends

The `Webium.JSRuntime` project defines `IJSBridge` with multiple backend implementations:

- **PuerTS (desktop/mobile):** V8 or QuickJS via PuerTS bindings.
- **Browser-native (WebGL):** The browser's own JS engine via jslib interop.
- **Future:** Any JS engine with C# interop can implement the same interface.

### Layout

Yoga (WASM bindings) handles flexbox, which covers 90%+ of modern web layouts. CSS Grid deferred to a later milestone.

### CSS

css-tree handles CSS parsing in JS. The full pipeline runs in `@webium/core`: selector matching (type, class, id, attribute, pseudo-class selectors with descendant/child/sibling combinators), specificity calculation, cascade resolution, style inheritance, and computed style resolution via depth-first tree traversal.

## Hard Problems

| Problem | Why it's hard | Mitigation |
|---|---|---|
| CSS cascade/specificity/inheritance | The bulk of browser complexity | Use css-tree for parsing; implement incrementally |
| `getComputedStyle` / `.offsetWidth` / `.offsetHeight` | react-dom reads layout back synchronously | Synchronous Yoga resolve on access, cache aggressively |
| Text/inline layout | Mixed inline elements, wrapping, line-height | Lean on engine text systems; keep inline layout minimal initially |
| Performance at scale | Hundreds of nodes with frequent updates | Dirty-flag batching, NodePool reuse, minimize Yoga re-layouts, typed array serialization |
| JS↔native interop overhead | High-frequency calls across the bridge | Batch all mutations into single RenderCommandBuffer per frame |
| Multi-engine backend maintenance | Each backend must implement interfaces correctly | Reference implementation (Unity) + shared interface contract tests |

## Prior Art & Why Not Use It

| Alternative | Why not |
|---|---|
| Embedded browser (ZFBrowser, Coherent GT) | Heavy, ships Chromium, not native engine UI, can't be modded easily, licensing costs |
| Unity UI Toolkit (UXML/USS) | Proprietary dialect, incomplete CSS, no JS, no runtime modding |
| UGUI | No markup language, no styling system, tedious for complex UI |
| Noesis GUI | XAML-based, not web standards, commercial license |
| Godot Control nodes | Engine-specific, no web standards, no modding story |

Webium is different: lightweight, native engine rendering, standard web APIs, designed for modding, and engine-agnostic with a JS-first core.

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|---|---|---|
| PuerTS | V8/QuickJS stability, mobile support | Actively maintained; QuickJS fallback for mobile |
| Browser JS (jslib) | Interop limitations, marshalling overhead | Well-documented; keep interop surface minimal |
| yoga-layout (WASM) | WASM support in embedded runtimes | Widely supported; fallback to native Yoga via P/Invoke |
| css-tree (JS) | Performance in embedded runtime | Lightweight; profile early, replace if needed |
| Multi-engine backends | Each must implement four interfaces correctly | Shared interface contract tests; Unity as reference implementation |

## Distribution

- **`@webium/core`:** npm package
- **C# libraries:** .NET Standard 2.1 NuGet packages or direct project references
- **Unity:** UPM package via git URL or OpenUPM
- **Godot:** NuGet package or direct project reference
- **Other engines:** NuGet or source reference to core libraries + engine-specific adapter
