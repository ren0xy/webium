# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-22

### Added

- UIElements render backend (`UIElementsRenderCommandExecutor`) — Webium can now render to Unity's UI Toolkit as an alternative to UGUI.
- `IWebiumRenderBackend` abstraction with `Executor`, `InputForwarder`, `LayoutBridge`, `TextMeasurer` properties — clean backend selection at initialization time.
- `RenderBackendType` enum (`UGUI`, `UIElements`) in `Webium.Core`.
- `WebiumSurfaceConfig` ScriptableObject for backend selection — assign to `WebiumSurface` to choose UGUI or UIElements.
- `UIElementsInputEventForwarder` — captures UIElements pointer events and forwards to JS.
- `UIElementsLayoutBridge` — reads layout values from `VisualElement.resolvedStyle`.
- `UIElementsTextMeasurer` and `UGUITextMeasurer` — native text measurement via `ITextMeasurer` interface, replacing the JS-side `0.6 * fontSize` heuristic.
- `__webium_measureText` C#↔JS binding for native font measurement from Yoga layout callbacks.
- CSS `font-family` property support with generic family keyword mapping (`sans-serif` → Arial, etc.) via `CSSFontFamilyResolver`.
- CSS `margin` and `padding` shorthand expansion (1/2/3/4-value forms) feeding into Yoga layout.
- CSS 2.1 §8.3.1 vertical margin collapsing — adjacent sibling and parent-child margin collapse with correct non-collapsing conditions.
- Generic `color` inheritance to all text-bearing elements (buttons, headings, containers with text children).
- Generic `background-color`, `font-size` application across all element types for both backends.
- UGUI border rendering support.

### Changed

- `WebiumSurface.Executor` now returns `IRenderCommandExecutor` (interface) instead of concrete `UnityRenderCommandExecutor`.
- `WebiumSurface.Awake()` delegates surface setup to the selected `IWebiumRenderBackend`.
- Yoga text measurement now uses native font metrics instead of the `avgCharWidth = fontSize * 0.6` heuristic (with graceful fallback for unit tests).

## [0.1.0] - 2026-02-16

### Added

- `UnityPuerTSRuntime` in `Webium.Unity.Runtime` — real `IJSRuntime` implementation using `Puerts.JsEnv` for desktop/mobile platforms. `PuerTSRuntime` in `Webium.JSRuntime` remains as a stub for the `dotnet test` pipeline.
- `ExecuteCreate` now adds visual Unity components based on `NodeTag`: `Image` for containers (Div, Body, Ul, Ol, Li), `TextMeshProUGUI` for text elements (Span, P, Text), heading-sized bold TMP for H1–H6, `Image` + `Button` for Button/A, `Image` + `TMP_InputField` for Input, `RawImage` for Img.
- `ExecuteUpdateStyle` extended with `background-color` (→ `Image.color`), `color` (→ `TextMeshProUGUI.color`), `font-size` (→ `TextMeshProUGUI.fontSize`), and `padding` (stub for v0.1.0, handled by Yoga on JS side).
- `WebiumBootstrapper` file path resolution: resolves `_uiFolderPath` relative to `Application.dataPath` or the Webium package root, working across git submodule, UPM, and manual install scenarios.
- esbuild bootstrap bundle switched to IIFE-compatible format (async wrapper around ESM) for PuerTS eval compatibility.
- Property-based tests for `ExecuteCreate` component assignment and `ExecuteUpdateStyle` CSS property application (FsCheck, 100 iterations each).

### Removed

- `ILayoutReadback` interface from `Webium.Core` — obsolete, replaced by `ILayoutReadbackNew`.
- `RectTransformSync` class from `Webium.Unity.Runtime` — stale tree-walking code referencing deleted `Webium.Layout` namespace.
- Three stale layout test files (`RectTransformSyncTests.cs`, `RectTransformSyncProperties.cs`, `YogaLayoutEngineTests.cs`).

### Changed

- `WebiumSurface.Awake()` now uses platform-conditional `#if UNITY_WEBGL` / `#else` to instantiate `BrowserRuntime` or `UnityPuerTSRuntime` instead of `JSRuntimeFactory.Create()`.
- `webium.unity.runtime.asmdef` now references the `Puerts` assembly.
- `ExecuteUpdateLayout` now sets top-left anchoring (anchorMin, anchorMax, pivot) on RectTransforms, inlined from the deleted `RectTransformSync.ApplyToRectTransform`.
- Rewrote layout tests for the new architecture: `ExecuteUpdateLayoutTests.cs`, `ExecuteUpdateLayoutProperties.cs`, `UnityLayoutBridgeTests.cs`.
- Documentation updated: VISION.md, README.md, ROADMAP.md clarify that `UnityPuerTSRuntime` in `Webium.Unity.Runtime` is the real PuerTS adapter and `PuerTSRuntime` in `Webium.JSRuntime` is a stub.

## [0.0.1] - 2026-02-15

### Added

- `@webium/core` TypeScript package with full implementation: VirtualDOM, CSS pipeline (css-tree parsing, selector matching, specificity, cascade, inheritance, computed style resolution), EventDispatcher (capture/target/bubble), yoga-layout WASM integration, ReconciliationEngine, render command protocol, input event protocol, and modding system (ManifestParser, CSSScoper, ModManager).
- 356 JS tests across 19 test files including property-based tests via fast-check.
- C# bridge interfaces: `IRenderCommandExecutor`, `IInputEventForwarder`, `ILifecycleDriver`, `ILayoutReadbackNew`, `RenderCommand`, `RenderOp`.
- Unity backend: `UnityRenderCommandExecutor`, `UnityInputEventForwarder`, nodeId-based `ReconciliationLoopBehaviour` and `UnityLayoutBridge`.
- `IJSBridge` with `CallTick()` and `ForwardInputEvent()` methods.

### Removed

- C# core logic projects: `Webium.API`, `Webium.CSS`, `Webium.Layout`, `Webium.Modding` (replaced by `@webium/core`).
- C# test projects: `Webium.API.Tests`, `Webium.CSS.Tests`, `Webium.Layout.Tests`, `Webium.Modding.Tests`.
- Migrated C# types from `Webium.Core` (VirtualDOM, VirtualNode, EventDispatcher, SelectorMatcher, etc.) — `Webium.Core` now contains only bridge interfaces and shared types.

### Changed

- Architecture shifted from C#-first to JS-first: all DOM, CSS, event, layout, reconciliation, and modding logic now lives in TypeScript.
- Unity backend consumes render commands from JS instead of directly manipulating C# DOM types.
- `Webium.Core` slimmed to bridge interfaces and shared data types only.
