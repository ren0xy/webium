# Improvements: UIElements Render Backend

## 1. Stale reverse map in UIElementsInputEventForwarder

### Problem

`UIElementsInputEventForwarder` maintains a `Dictionary<VisualElement, int>` reverse map for hit-testing (mapping a hit VisualElement back to a nodeId). This map is populated once at construction time by iterating over the executor's `NodeElements` dictionary:

```csharp
// UIElementsInputEventForwarder constructor
foreach (var kvp in _nodeElements)
    _reverseMap[kvp.Value] = kvp.Key;
```

The forwarder exposes `RegisterNode()` and `UnregisterNode()` methods designed to keep this map in sync, but the executor never calls them. When `ExecuteCreate` adds a new entry to `_nodeElements`, or `ExecuteDestroy` removes one, the forwarder's `_reverseMap` is not updated.

### Why it partially works anyway

`ResolveNodeId()` walks up the VisualElement parent chain until it finds a match in `_reverseMap`. For dynamically created nodes, the node itself won't be in the map, but an ancestor that existed at construction time might be. So clicks on new nodes resolve to the nearest ancestor that was in the initial batch — wrong nodeId, but not a crash.

For destroyed nodes, the reverse map retains stale entries pointing to VisualElements that are no longer in the tree. These won't cause crashes (the VisualElement is detached, so it won't receive events), but the map grows unboundedly.

### Impact

- Input events on nodes created after the initial render tick resolve to the wrong nodeId (nearest mapped ancestor instead of the actual target).
- The reverse map leaks entries for destroyed nodes.
- The first render tick (from `WebiumBootstrapper.Start()`) creates all initial nodes before the forwarder is constructed, so the initial page works correctly. The bug only manifests on subsequent DOM mutations (JS-driven creates/destroys after the first tick).

### Fix

Wire the executor to call `RegisterNode`/`UnregisterNode` on the forwarder. Two options:

**Option A — Executor holds a reference to the forwarder:**

```csharp
// In UIElementsRenderCommandExecutor
private UIElementsInputEventForwarder _inputForwarder;

public void SetInputForwarder(UIElementsInputEventForwarder forwarder)
    => _inputForwarder = forwarder;

private void ExecuteCreate(RenderCommand cmd)
{
    // ... existing create logic ...
    _nodeElements[cmd.NodeId] = ve;
    _inputForwarder?.RegisterNode(cmd.NodeId, ve);
}

private void ExecuteDestroy(RenderCommand cmd)
{
    if (_nodeElements.TryGetValue(cmd.NodeId, out var ve))
    {
        _inputForwarder?.UnregisterNode(ve);
        ve.RemoveFromHierarchy();
        _nodeElements.Remove(cmd.NodeId);
    }
}
```

Then in `UIElementsRenderBackend` constructor, after creating both:

```csharp
_executor.SetInputForwarder(_inputForwarder);
```

**Option B — Event/callback approach (looser coupling):**

Add an `Action<int, VisualElement>` and `Action<VisualElement>` callback pair on the executor that the forwarder subscribes to. Avoids the executor knowing about the forwarder type directly.

Option A is simpler and sufficient given both types live in the same assembly and are always used together.

## 2. `font-weight` and `font-style` overwrite each other

### Problem

In `UIElementsRenderCommandExecutor.ExecuteUpdateStyle`, `font-weight` and `font-style` both set `style.unityFontStyleAndWeight` independently. If a command contains both `font-weight: bold` and `font-style: italic`, whichever is processed last wins — you get either bold or italic, never bold-italic.

### Fix

Collect both values first, then combine:

```csharp
bool bold = false, italic = false;

if (cmd.Styles.TryGetValue("font-weight", out var fw))
    bold = fw.Trim().ToLowerInvariant() == "bold"
        || (int.TryParse(fw.Trim(), out int w) && w >= 700);

if (cmd.Styles.TryGetValue("font-style", out var fs))
    italic = fs.Trim().ToLowerInvariant() == "italic";

if (bold && italic)
    ve.style.unityFontStyleAndWeight = FontStyle.BoldAndItalic;
else if (bold)
    ve.style.unityFontStyleAndWeight = FontStyle.Bold;
else if (italic)
    ve.style.unityFontStyleAndWeight = FontStyle.Italic;
else if (cmd.Styles.ContainsKey("font-weight") || cmd.Styles.ContainsKey("font-style"))
    ve.style.unityFontStyleAndWeight = FontStyle.Normal;
```
