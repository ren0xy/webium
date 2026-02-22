using System.Collections.Generic;
using UnityEngine.UIElements;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Implements ILayoutReadbackNew for the UIElements backend.
    /// Reads VisualElement.layout rect for synchronous JS layout queries.
    /// </summary>
    public class UIElementsLayoutBridge : ILayoutReadbackNew
    {
        private readonly IReadOnlyDictionary<int, VisualElement> _nodeElements;

        public UIElementsLayoutBridge(IReadOnlyDictionary<int, VisualElement> nodeElements)
        {
            _nodeElements = nodeElements;
        }

        public float GetX(int nodeId)
        {
            return TryGetElement(nodeId, out var ve) ? ve.layout.x : 0f;
        }

        public float GetY(int nodeId)
        {
            return TryGetElement(nodeId, out var ve) ? ve.layout.y : 0f;
        }

        public float GetWidth(int nodeId)
        {
            return TryGetElement(nodeId, out var ve) ? ve.layout.width : 0f;
        }

        public float GetHeight(int nodeId)
        {
            return TryGetElement(nodeId, out var ve) ? ve.layout.height : 0f;
        }

        private bool TryGetElement(int nodeId, out VisualElement ve)
        {
            return _nodeElements.TryGetValue(nodeId, out ve);
        }
    }
}
