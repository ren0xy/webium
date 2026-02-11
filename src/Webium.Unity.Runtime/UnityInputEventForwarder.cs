using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Implements IInputEventForwarder for Unity.
    /// Converts Unity EventSystem events to InputEvent structs,
    /// hit-tests to determine targetNodeId, and forwards to JS.
    /// </summary>
    public class UnityInputEventForwarder : IInputEventForwarder
    {
        private readonly IJSBridge _bridge;
        private readonly Dictionary<int, GameObject> _nodeObjects;

        public UnityInputEventForwarder(IJSBridge bridge, Dictionary<int, GameObject> nodeObjects)
        {
            _bridge = bridge;
            _nodeObjects = nodeObjects;
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
        /// Performs hit-testing against the Unity scene to find which nodeId
        /// was hit at the given screen position.
        /// </summary>
        public int HitTest(Vector2 screenPosition)
        {
            var eventData = new PointerEventData(EventSystem.current)
            {
                position = screenPosition
            };
            var results = new List<RaycastResult>();
            EventSystem.current.RaycastAll(eventData, results);

            foreach (var result in results)
            {
                foreach (var kvp in _nodeObjects)
                {
                    if (kvp.Value == result.gameObject)
                        return kvp.Key;
                }
            }

            return -1; // No hit
        }
    }
}
