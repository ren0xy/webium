# Webium - Roadmap

## v0.0.1 - JS Core Architecture ✅

Architecture established with JS-first core. `@webium/core` TypeScript package owns DOM, CSS pipeline, events, layout, reconciliation, and modding. C# reduced to thin bridge layer (render command execution, input event forwarding, engine-specific integration). Unity backend migrated to consume render commands.

What was delivered:
- Virtual DOM with node pool, dirty queue, and cycle detection
- Full CSS pipeline: css-tree parsing, selector matching (compound selectors + combinators), specificity, cascade, inheritance, computed style resolution
- Event system with capture/target/bubble phases, stopPropagation, stopImmediatePropagation
- Layout via yoga-layout WASM
- Reconciliation engine: dirty queue → style resolve → layout → RenderCommandBuffer
- Render command protocol with typed array and JSON serialization
- Input event protocol for pointer and focus events
- Modding system: manifest parser, CSS scoper (with idempotent scoping), mod manager
- Unity backend: UnityRenderCommandExecutor, UnityInputEventForwarder, UnityLayoutBridge
- Property-based tests via fast-check for all core correctness properties

## v0.1.0 - HelloWorld End-to-End ✅

Hello world Unity project with HTML/CSS/JS rendering as native GameObjects. A designated folder in a Unity project contains a UI project with HTML, CSS, and JS files. Pressing Play renders that UI in the game view with text rendering and basic interactivity.

What was delivered:
- `UnityPuerTSRuntime` — real `IJSRuntime` implementation using PuerTS `Puerts.JsEnv` for desktop/mobile
- HTML parsing via htmlparser2 (div, span, p, img, button, input, a, ul/ol/li, h1-h6, style, script)
- CSS file loading from `<link>` tags and inline `<style>` blocks
- Full DOM API surface: `querySelector/All`, `getElementById`, `createElement`, `appendChild/removeChild/insertBefore`, `setAttribute`, `style`, `textContent/innerHTML`, `addEventListener/removeEventListener`
- DOM mutations from JS flow through reconciliation and produce render commands
- Click event round-trip: Unity pointer events → InputEvent bridge → JS event dispatch → user callback
- Unity visual realization: GameObjects with Image, TextMeshProUGUI, and Button components based on NodeTag
- Style application: `background-color`, `color`, `font-size`, `padding`, and common layout styles
- Yoga-layout integration for CSS flexbox layout
- esbuild bootstrap bundle with async IIFE wrapper for PuerTS eval compatibility
- `WebiumBootstrapper` with path resolution across git submodule, UPM, and manual install
- Working HelloWorld UI: styled heading, paragraph, and button with click-driven DOM mutation

## v0.2.0 - Dual Backend & CSS Fidelity ✅

Functional hello-world example for both UGUI and UIElements backends with improved CSS rendering fidelity.

What was delivered:
- UIElements render backend (`UIElementsRenderCommandExecutor`) as alternative to UGUI
- `IWebiumRenderBackend` abstraction — clean backend selection via `WebiumSurfaceConfig` ScriptableObject
- `RenderBackendType` enum (`UGUI`, `UIElements`) for configuration-driven backend selection
- UIElements input handling (`UIElementsInputEventForwarder`) and layout readback (`UIElementsLayoutBridge`)
- Native text measurement bridge (`ITextMeasurer`) replacing the JS-side `0.6 * fontSize` heuristic
- `CSSFontFamilyResolver` for `font-family` generic keyword mapping (`sans-serif`, `serif`, `monospace`)
- CSS `margin` and `padding` shorthand expansion (1/2/3/4-value forms)
- CSS 2.1 vertical margin collapsing (adjacent siblings, parent-child)
- Generic CSS property application (`color`, `background-color`, `font-size`) across all element types and both backends
- UGUI border rendering

## v0.3.0 - Interactivity & Richer CSS (next)

More complex examples to expand CSS support and add JS interactivity beyond simple click counters.

Planned direction:
- Button click event handling with DOM mutations (add/remove elements, toggle visibility)
- Text input fields with live DOM updates
- More CSS properties: borders (UIElements), border-radius, opacity, visibility, display modes, overflow
- Pseudo-classes (`:hover`, `:active`, `:focus`)
- Flexbox completeness (flex-wrap, align-content, gap, order)
- Scroll containers and overflow handling
- Improved text rendering (inline spans, line-height, text-decoration)
- Interactive and styled example UI projects exercising the expanded feature set

---

See [VISION.md](VISION.md) for the full project vision and architecture.
