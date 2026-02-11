# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
