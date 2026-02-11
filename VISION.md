# Webium — Vision

> Browser-grade DOM/CSS/JS engine for Unity UI — run standard web code natively in Unity via PuerTS.

## Problem

Unity's built-in UI systems are painful. UGUI is powerful but tedious to build complex interfaces with. UI Toolkit (UXML/USS) attempted to bring web-like authoring to Unity but introduced its own dialect, tooling friction, and incomplete CSS support — solving the wrong problem by inventing yet another markup/styling language instead of using the ones millions of developers already know.

Meanwhile, web UI development has decades of mature tooling, frameworks, and developer knowledge. There's no good reason Unity developers should have to learn a proprietary UI system when HTML/CSS/JS already solves 2D UI comprehensively.

There's also no viable path today for runtime UI modding in Unity games. Games like World of Warcraft proved that exposing a web-like UI layer to modders creates thriving addon ecosystems. Unity has nothing equivalent.

## Vision

Webium is a Unity package that lets you build 2D UI using standard HTML, CSS, and JavaScript. It maintains a virtual DOM in C#, exposes faithful browser APIs (`window`, `document`, `Element`, events, styles) via PuerTS, and translates everything into native Unity UI components (RectTransform, Image, RawImage, TextMeshPro, CanvasGroup, RectMask2D).

From JavaScript's perspective, it's running in a real web browser. From Unity's perspective, it's just GameObjects on a Canvas.

## Target Audience

- **Unity developers** who are tired of UGUI boilerplate and UI Toolkit's half-measures, and already know HTML/CSS.
- **Web developers** entering Unity who want to use familiar tools and frameworks.
- **Game studios** that want to enable runtime UI modding (addon systems, custom HUDs, player-created interfaces).
- **Modders** who can write HTML/CSS/JS and want to create UI addons for games without learning Unity internals.

## Goals

- Translate HTML/CSS into Unity UI visuals at runtime.
- Implement browser DOM/CSS/Style APIs faithfully enough that standard JS libraries (React, Vue, etc.) work unmodified via `react-dom` — no custom reconcilers, no forked renderers.
- JavaScript bound to C# via PuerTS manipulates virtual DOM nodes, which are reflected as real Unity UI components.
- Enable runtime UI modding: games can expose a Webium surface where players load HTML/CSS/JS addons.
- Feel like building a webpage. No new languages, no new tooling, no UXML, no USS.

## Non-Goals

- Not a web browser. No networking, no navigation, no URL bar, no tabs.
- No WebGL, Canvas 2D, SVG, or video/audio playback.
- No HTTP requests or fetch API (games can expose their own data APIs to JS separately).
- No accessibility tree or screen reader support (Unity limitation).
- Not targeting pixel-perfect parity with Chrome — targeting "close enough that real apps work and look right."

## Architecture

### Two-sided design

**JS side (PuerTS runtime):**
`window`, `document`, `HTMLElement`, `CSSStyleDeclaration`, `Event`, etc. are JS classes that proxy all mutations to C# via PuerTS interop. Setting `.style.display = 'flex'` calls into C# and marks the node dirty.

**C# side (Unity):**
A `VirtualDOM` tree of `VirtualNode` objects. Each node owns a `GameObject` with Unity UI components. Layout engine (Yoga) computes positions. Event system handles bubbling/capture. Visual properties map to Unity components.

**Per-frame loop:**
Dirty nodes → Yoga layout pass → RectTransform updates → Unity component property sync.

### Required Browser API Surface

The subset that covers most web apps and `react-dom`:

| Category | APIs |
|---|---|
| DOM tree ops | `createElement`, `createTextNode`, `appendChild`, `removeChild`, `insertBefore`, `replaceChild`, `cloneNode` |
| Attributes/props | `setAttribute`, `getAttribute`, `classList`, `style`, `id`, `className` |
| Querying | `getElementById`, `querySelector` (basic CSS selectors) |
| Events | `addEventListener`, `removeEventListener`, `dispatchEvent` with bubbling/capture |
| Window | `requestAnimationFrame`, `setTimeout`, `setInterval`, `getComputedStyle`, `innerWidth/Height` |
| Style object | Individual CSS properties mapped to layout engine + visual properties |

### CSS → Unity Mapping

| CSS Property | Unity Component |
|---|---|
| Flexbox layout | Yoga → `RectTransform` position/size |
| `background-color` | `Image` component color |
| `color` | TextMeshPro text color |
| `border-radius`, `border` | Sliced sprites or procedural UI |
| `opacity` | `CanvasGroup` alpha |
| `overflow: hidden` | `RectMask2D` |
| `img` src | `RawImage` with async texture loading |
| `font-size`, `font-family` | TextMeshPro font asset + size |

### Layout

Yoga (C# port) handles flexbox, which covers 90%+ of modern web layouts. CSS Grid deferred to a later milestone.

### CSS Parsing

Embed a JS-based CSS parser (e.g. `css-tree`) running inside PuerTS. Handles specificity, cascading, and inheritance on the JS side before passing computed values to C#. Avoids writing a CSS parser in C#.

## Hard Problems

| Problem | Why it's hard | Mitigation |
|---|---|---|
| CSS cascade/specificity/inheritance | The bulk of browser complexity | Use existing JS CSS parser; implement incrementally |
| `getComputedStyle` / `.offsetWidth` / `.offsetHeight` | react-dom reads layout back synchronously | Synchronous Yoga resolve on access, cache aggressively |
| Text/inline layout | Mixed inline elements, wrapping, line-height | Lean on TextMeshPro; keep inline layout minimal initially |
| Performance at scale | Hundreds of nodes with frequent updates | Dirty-flag batching, pool GameObjects, minimize Yoga re-layouts |
| PuerTS ↔ C# interop overhead | High-frequency calls across the bridge | Batch mutations, minimize per-property calls |

## Prior Art & Why Not Use It

| Alternative | Why not |
|---|---|
| Embedded browser (ZFBrowser, Coherent GT) | Heavy, ships Chromium, not native Unity UI, can't be modded easily, licensing costs |
| UI Toolkit (UXML/USS) | Proprietary dialect, incomplete CSS, no JS, no runtime modding |
| UGUI | No markup language, no styling system, tedious for complex UI |
| Noesis GUI | XAML-based, not web standards, commercial license |

Webium is different: lightweight, native Unity rendering, standard web APIs, designed for modding.

## Milestones

### v0.1 — Proof of Concept
- Virtual DOM with `createElement`, `appendChild`, `removeChild`
- `<div>` renders as GameObject with RectTransform + Image
- Flexbox layout via Yoga (row, column, justify, align)
- `background-color`, `width`, `height`, `margin`, `padding`
- Click events with `addEventListener`
- PuerTS bridge: JS creates and styles divs, sees them in Unity

**Exit criteria:** A JS script creates a flexbox layout of colored divs with click handlers, rendered as native Unity UI.

### v0.2 — Text & Images
- `<span>`, `<p>` → TextMeshPro components
- `<img>` → RawImage with texture loading
- `color`, `font-size`, `text-align`
- `opacity`, `overflow: hidden`
- `id`, `className`, `getElementById`, `querySelector`

**Exit criteria:** A JS script builds a card UI with image, title, description, and styled text.

### v0.3 — Full Event Model & Styles
- Event bubbling, capture, `stopPropagation`, `preventDefault`
- `classList.add/remove/toggle`
- CSS parser integration (css-tree in PuerTS)
- `<style>` tag parsing and application
- Specificity and cascade resolution
- `hover` and `focus` pseudo-states via Unity event system

**Exit criteria:** A standalone HTML/CSS/JS file (no framework) renders and behaves correctly.

### v0.4 — Layout Readback & Framework Compat
- `getComputedStyle` returns resolved values
- `.offsetWidth`, `.offsetHeight`, `.getBoundingClientRect()`
- `requestAnimationFrame`, `setTimeout`, `setInterval`
- `document.createDocumentFragment`
- Microtask queue alignment

**Exit criteria:** `react-dom` renders a component tree with state, effects, and re-renders — unmodified.

### v0.5 — Modding Runtime
- Sandboxed JS execution contexts (isolated per addon)
- Game-defined API surface exposed to mods (inventory, player data, etc.)
- Hot-reload: load/unload HTML/CSS/JS bundles at runtime
- Mod manifest format and loader

**Exit criteria:** A sample game loads two independent UI mods from disk at runtime, each with their own HTML/CSS/JS, rendered side by side.

### v1.0 — Production Ready
- Performance profiling and optimization
- Memory management and GameObject pooling
- Documentation and API reference
- Sample projects (vanilla JS, React app, modding example)
- Unity 2021.3+ LTS support confirmed

## Dependencies & Risks

| Dependency | Risk | Mitigation |
|---|---|---|
| PuerTS | V8/QuickJS stability in Unity, mobile support | PuerTS is actively maintained; QuickJS fallback for mobile |
| Yoga (C# port) | Port completeness, edge cases | NFlexLayout or direct native Yoga via P/Invoke as fallback |
| TextMeshPro | Unity dependency, inline layout limits | TMP is standard in Unity; accept its limitations for v1 |
| css-tree (JS) | Running in PuerTS, performance | Lightweight; profile early, replace if needed |

## Project Setup

Distributed as a Unity Package (UPM).

### Package: `com.webium.core`

Install via `Packages/manifest.json`:
```json
"com.webium.core": "https://github.com/yourname/webium.git"
```

### Repository Structure

```
webium/
├── package.json              # UPM package manifest
├── Runtime/
│   ├── webium.runtime.asmdef
│   ├── Core/
│   │   ├── VirtualDOM.cs
│   │   ├── VirtualNode.cs
│   │   └── LayoutEngine.cs   # Yoga wrapper
│   ├── Components/
│   │   ├── DivRenderer.cs
│   │   ├── ImageRenderer.cs
│   │   └── TextRenderer.cs
│   ├── API/
│   │   ├── DocumentAPI.cs
│   │   ├── WindowAPI.cs
│   │   └── ElementAPI.cs
│   └── Bridge/
│       └── PuertsBridge.cs
├── Editor/
│   ├── webium.editor.asmdef
│   └── WebiumInspector.cs
├── Plugins/
│   └── Yoga/                 # native yoga lib
├── Resources~/
│   └── js/                   # JS shims, CSS parser
├── Samples~/
│   ├── HelloWorld/
│   └── ReactApp/
├── CHANGELOG.md
├── LICENSE
├── README.md
└── VISION.md                 # this document
```

### UPM `package.json`

```json
{
  "name": "com.webium.core",
  "version": "0.1.0",
  "displayName": "Webium",
  "description": "Browser-grade DOM/CSS/JS engine for Unity UI",
  "unity": "2021.3",
  "dependencies": {},
  "author": {
    "name": "Your Name",
    "url": "https://github.com/yourname/webium"
  }
}
```

### Development

Keep a separate private Unity project (e.g. `webium-dev`) for testing and development with scenes and test scripts that references the package locally. Don't ship it.

## Timeline Estimate

| Milestone | Estimated effort |
|---|---|
| v0.1 Proof of Concept | 4–6 weeks |
| v0.2 Text & Images | 3–4 weeks |
| v0.3 Events & CSS | 6–8 weeks |
| v0.4 Framework Compat | 4–6 weeks |
| v0.5 Modding Runtime | 4–6 weeks |
| v1.0 Polish & Docs | 4–6 weeks |
| **Total** | **~6–9 months** |
