---
name: gen-kb-unity-uitoolkit
description: Knowledge about Unity UI Toolkit (UIElements) runtime quirks, event handling, and PanelSettings configuration.
---

### UIElements `position: absolute` bypasses built-in Yoga when external layout engine owns layout
When an external layout engine (e.g., JS-side Yoga) computes layout and sends absolute positions via render commands, set `style.position = Position.Absolute` on all UIElements nodes. This prevents UIElements' own Yoga instance from interfering with the externally-computed layout values.

### Runtime PanelSettings via ScriptableObject.CreateInstance for UIDocument setup
`ScriptableObject.CreateInstance<PanelSettings>()` creates a valid PanelSettings at runtime without requiring a pre-existing asset. Set `scaleMode`, `referenceResolution`, and assign to `uiDocument.panelSettings`. Remember to `Destroy()` the instance in `Dispose()`.

### PanelSettings.referenceResolution is Vector2Int, not Vector2
`PanelSettings.referenceResolution` is typed `Vector2Int`. Assigning a `Vector2` directly causes CS0029. Use `new Vector2Int((int)v.x, (int)v.y)`.

### UIElements TrickleDown.TrickleDown for root-level event capture
Register pointer callbacks on the root `VisualElement` with `TrickleDown.TrickleDown` to capture events before they reach child elements. Use `evt.target` cast to `VisualElement` and walk up parents to resolve the hit node.

### UIElements VisualElement.Insert requires index <= childCount — clamp sibling indices
`VisualElement.Insert(index, child)` throws `ArgumentOutOfRangeException` if `index > parent.childCount`. When non-visual nodes are skipped during creation, sibling indices from render commands can exceed the actual child count. Always clamp: `Math.Min(cmd.SiblingIndex.Value, parent.childCount)`.

### Runtime PanelSettings needs serialized ThemeStyleSheet reference
`ScriptableObject.CreateInstance<PanelSettings>()` has no theme and `Resources.Load<ThemeStyleSheet>()` returns null because the `.tss` isn't in a Resources folder. The theme must be a serialized asset reference. Add an optional `PanelSettings` field to the config ScriptableObject with the theme pre-assigned.

### UIDocument Inspector selection detaches runtime-added VisualElements
Selecting a UIDocument GameObject in the hierarchy during play mode causes Unity to rebuild the visual tree, detaching any VisualElements added via code. Add a MonoBehaviour that checks in `LateUpdate` if the root's `panel` is null or parent changed, and re-adds it.

### Reverse lookup dictionary for VisualElement→nodeId mapping in input hit-testing
When a UIElements input forwarder needs to map from a hit `VisualElement` back to a `nodeId`, maintain a `Dictionary<VisualElement, int>` reverse map alongside the forward `Dictionary<int, VisualElement>`. Provide `RegisterNode`/`UnregisterNode` methods called by the executor on create/destroy.
