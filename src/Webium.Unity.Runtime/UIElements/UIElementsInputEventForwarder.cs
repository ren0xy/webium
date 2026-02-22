using System.Collections.Generic;
using UnityEngine.UIElements;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Implements IInputEventForwarder for UIElements.
    /// Registers pointer callbacks on the root VisualElement using TrickleDown,
    /// resolves hit targets via a reverse lookup map (VisualElement → nodeId),
    /// and forwards events to JS through the bridge.
    /// </summary>
    public class UIElementsInputEventForwarder : IInputEventForwarder
    {
        private readonly IJSBridge _bridge;
        private readonly IReadOnlyDictionary<int, VisualElement> _nodeElements;
        private readonly VisualElement _root;
        private readonly Dictionary<VisualElement, int> _reverseMap = new Dictionary<VisualElement, int>();

        public UIElementsInputEventForwarder(
            IJSBridge bridge,
            IReadOnlyDictionary<int, VisualElement> nodeElements,
            VisualElement root)
        {
            _bridge = bridge;
            _nodeElements = nodeElements;
            _root = root;

            // Build initial reverse map from existing nodeElements
            foreach (var kvp in _nodeElements)
            {
                _reverseMap[kvp.Value] = kvp.Key;
            }

            // Register callbacks with TrickleDown to capture before children
            _root.RegisterCallback<PointerDownEvent>(OnPointerDown, TrickleDown.TrickleDown);
            _root.RegisterCallback<PointerUpEvent>(OnPointerUp, TrickleDown.TrickleDown);
            _root.RegisterCallback<ClickEvent>(OnClick, TrickleDown.TrickleDown);
            _root.RegisterCallback<PointerMoveEvent>(OnPointerMove, TrickleDown.TrickleDown);
        }

        /// <summary>
        /// Registers a node in the reverse lookup map.
        /// Called by the executor when a new element is created.
        /// </summary>
        public void RegisterNode(int nodeId, VisualElement element)
        {
            _reverseMap[element] = nodeId;
        }

        /// <summary>
        /// Unregisters a node from the reverse lookup map.
        /// Called by the executor when an element is destroyed.
        /// </summary>
        public void UnregisterNode(VisualElement element)
        {
            _reverseMap.Remove(element);
        }

        public void ForwardPointerEvent(string type, int targetNodeId, float clientX, float clientY, int button, int pointerId)
        {
            var json = $"{{\"type\":\"{type}\",\"targetNodeId\":{targetNodeId},\"clientX\":{clientX},\"clientY\":{clientY},\"button\":{button},\"pointerId\":{pointerId}}}";
            _bridge.ForwardInputEvent(json);
        }

        public void ForwardFocusEvent(string type, int targetNodeId, int relatedTargetId)
        {
            var json = $"{{\"type\":\"{type}\",\"targetNodeId\":{targetNodeId},\"relatedTargetId\":{relatedTargetId}}}";
            _bridge.ForwardInputEvent(json);
        }

        /// <summary>
        /// Walks up the VisualElement parent chain from the event target
        /// until a match in the reverse map is found, returning the nodeId.
        /// Returns -1 if no mapped ancestor is found.
        /// </summary>
        private int ResolveNodeId(VisualElement target)
        {
            var current = target;
            while (current != null)
            {
                if (_reverseMap.TryGetValue(current, out var nodeId))
                    return nodeId;
                current = current.parent;
            }
            return -1;
        }

        private void OnPointerDown(PointerDownEvent evt)
        {
            var target = evt.target as VisualElement;
            if (target == null) return;

            var nodeId = ResolveNodeId(target);
            if (nodeId < 0) return;

            ForwardPointerEvent("pointerdown", nodeId, evt.position.x, evt.position.y, evt.button, evt.pointerId);
        }

        private void OnPointerUp(PointerUpEvent evt)
        {
            var target = evt.target as VisualElement;
            if (target == null) return;

            var nodeId = ResolveNodeId(target);
            if (nodeId < 0) return;

            ForwardPointerEvent("pointerup", nodeId, evt.position.x, evt.position.y, evt.button, evt.pointerId);
        }

        private void OnClick(ClickEvent evt)
        {
            var target = evt.target as VisualElement;
            if (target == null) return;

            var nodeId = ResolveNodeId(target);
            if (nodeId < 0) return;

            // ClickEvent doesn't have button/pointerId — use defaults (left button, pointer 0)
            ForwardPointerEvent("click", nodeId, evt.position.x, evt.position.y, 0, 0);
        }

        private void OnPointerMove(PointerMoveEvent evt)
        {
            var target = evt.target as VisualElement;
            if (target == null) return;

            var nodeId = ResolveNodeId(target);
            if (nodeId < 0) return;

            ForwardPointerEvent("pointermove", nodeId, evt.position.x, evt.position.y, evt.button, evt.pointerId);
        }

        /// <summary>
        /// Unregisters all event callbacks from the root element.
        /// Called during backend disposal.
        /// </summary>
        public void Dispose()
        {
            _root.UnregisterCallback<PointerDownEvent>(OnPointerDown, TrickleDown.TrickleDown);
            _root.UnregisterCallback<PointerUpEvent>(OnPointerUp, TrickleDown.TrickleDown);
            _root.UnregisterCallback<ClickEvent>(OnClick, TrickleDown.TrickleDown);
            _root.UnregisterCallback<PointerMoveEvent>(OnPointerMove, TrickleDown.TrickleDown);
            _reverseMap.Clear();
        }
    }
}
