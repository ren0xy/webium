---
name: gen-kb-css-pipeline
description: Knowledge about Webium's CSS parsing, cascade resolution, and shorthand expansion pipeline.
---

### CSS Shorthand Expansion Integration Point
Shorthand expansion (margin/padding → individual longhands) runs at the end of `CascadeResolver.resolve()`, after all cascade rules and inline styles are applied. The expander is injected via constructor for testability. Explicit longhand properties in the map are preserved — the expander only sets longhands not already present.

### Shorthand Expansion Affects Downstream Consumers
After shorthand expansion, C# render backends receive individual properties (`padding-top`, `margin-left`, etc.) instead of shorthands. Both UGUI and UIElements executors need handlers for individual longhand properties. Keep shorthand handlers as backward-compatibility fallbacks.

### INITIAL_VALUES Must Not Contain Shorthands
`INITIAL_VALUES` in `style-inheritance.ts` must only contain longhand properties. If shorthands like `margin` or `padding` are present, `StyleInheritance.applyInheritance()` re-introduces them into the computed style after the cascade resolver already expanded and removed them. This causes the shorthand (with initial value `0`) to appear alongside the expanded longhands in the computed style sent to C#, potentially overriding them.

### UA Tag Defaults Live in ComputedStyleResolver
User-agent default styles (e.g., `display:block` for div/body/p/h1–h6, `display:none` for head/script/style/link, heading font-sizes, `display:inline-block` for button/input) are applied in `ComputedStyleResolver.resolveNode()` via the `UA_TAG_DEFAULTS` map. They are injected into the cascaded style map before inheritance, so any stylesheet rule or inline style overrides them. This is the single source of truth for UA defaults — avoid duplicating them in Yoga's `_applyUADefaults`.

### font-size Initial Value Is "16px" Not "medium"
The CSS keyword `medium` for `font-size` was changed to `"16px"` in `INITIAL_VALUES` because downstream consumers (C# TMP, Yoga text measurement) need a numeric pixel value. The keyword `medium` maps to 16px in browsers. Using the resolved value avoids every consumer needing to resolve the keyword independently.

### Body UA Margin Omitted Intentionally
The standard browser UA default of `margin: 8px` on `<body>` is intentionally not applied in Webium's `UA_TAG_DEFAULTS`. Browsers handle body margin visually via background propagation (body background extends behind its margin to fill the viewport), which Webium doesn't implement. Including the margin creates a visible gap between the body background and the viewport edge in Unity. Most CSS resets zero body margin anyway.

### Yoga Body Width Must Not Be Forced to 100%
In `YogaLayoutEngine._applyUADefaults`, the body element must not have `setWidth("100%")`. With flexbox stretch (the default), Yoga auto-sizes block children to fill available space minus margins. Forcing 100% width causes the body to be viewport-width and then margins are added on top, causing overflow. Only `setHeight("100%")` is needed for the body.
