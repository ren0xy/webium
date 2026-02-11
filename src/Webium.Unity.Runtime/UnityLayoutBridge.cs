using System.Collections.Generic;
using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Implements ILayoutReadbackNew for Unity.
    /// Reads RectTransform positions and dimensions for synchronous JS queries.
    /// Also bridges canvas size to the layout engine.
    /// </summary>
    public class UnityLayoutBridge : ILayoutReadbackNew
    {
        private readonly RectTransform _canvasRect;
        private readonly Dictionary<int, GameObject> _nodeObjects;

        public UnityLayoutBridge(RectTransform canvasRect, Dictionary<int, GameObject> nodeObjects)
        {
            _canvasRect = canvasRect;
            _nodeObjects = nodeObjects;
        }

        public float GetX(int nodeId)
        {
            var rt = GetRectTransform(nodeId);
            return rt != null ? rt.anchoredPosition.x : 0f;
        }

        public float GetY(int nodeId)
        {
            var rt = GetRectTransform(nodeId);
            return rt != null ? -rt.anchoredPosition.y : 0f;
        }

        public float GetWidth(int nodeId)
        {
            var rt = GetRectTransform(nodeId);
            return rt != null ? rt.sizeDelta.x : 0f;
        }

        public float GetHeight(int nodeId)
        {
            var rt = GetRectTransform(nodeId);
            return rt != null ? rt.sizeDelta.y : 0f;
        }

        /// <summary>
        /// Gets the canvas dimensions for container sizing.
        /// </summary>
        public Vector2 GetCanvasSize()
        {
            return _canvasRect != null ? _canvasRect.rect.size : Vector2.zero;
        }

        private RectTransform GetRectTransform(int nodeId)
        {
            if (_nodeObjects.TryGetValue(nodeId, out var go))
                return go.GetComponent<RectTransform>();
            return null;
        }
    }
}
