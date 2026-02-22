---
name: gen-kb-unity-render-backends
description: Knowledge about Webium's UGUI and UIElements render command executors and style application patterns.
---

### UGUI Text Component Lookup Pattern
When applying text-related styles (color, font-size, font-family) in UGUI, always check the element's own `TextMeshProUGUI` first, then fall back to the `__WebiumText` child. This pattern is used by `ApplyTextColor`, `ApplyFontSize`, and `ApplyFontFamily`.

### UGUI Style Cache for Deferred Text Children
UGUI executor caches all applied styles per node ID in `_appliedStyles`. When `ExecuteUpdateText()` creates a new `__WebiumText` child, it applies cached `color`, `font-size`, and `font-family` to the new TMP component. This handles the case where styles arrive before text content. Remember to clean up the cache in `ExecuteDestroy()`.

### UIElements Style Cascading vs UGUI Manual Propagation
UIElements automatically cascades `style.color` and `style.fontSize` to child elements via UI Toolkit's style system. UGUI does not — text styles must be manually propagated to `__WebiumText` children. This is why UGUI needs the `_appliedStyles` cache but UIElements does not.

### Font Family Resolution Architecture
`CSSFontFamilyResolver` is a shared static class used by both backends. UGUI calls `ResolveTMP()` for `TMP_FontAsset`, UIElements calls `ResolveFont()` for `Font`. Resolution priority: registered mappings → generic family keywords → `Resources.Load` → default fallback. Runtime extensibility via `Register()` method.

### IWebiumRenderBackend: constructor-based setup keeps interface engine-agnostic
When designing a render backend abstraction that needs Unity-specific parameters (Transform, Vector2, IJSBridge), put setup logic in the constructor rather than an interface method. The interface stays in the engine-agnostic core assembly with only property accessors (Executor, InputForwarder, LayoutBridge), while each backend's constructor accepts the platform-specific dependencies it needs.
