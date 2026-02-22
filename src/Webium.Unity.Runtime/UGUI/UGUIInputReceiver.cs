using UnityEngine;
using UnityEngine.EventSystems;

namespace Webium.Unity
{
    public class UGUIInputReceiver : MonoBehaviour,
        IPointerClickHandler, IPointerDownHandler,
        IPointerUpHandler, IPointerMoveHandler
    {
        private UGUIInputEventForwarder _forwarder;

        public void Initialize(UGUIInputEventForwarder forwarder)
        {
            _forwarder = forwarder;
        }

        public void OnPointerClick(PointerEventData eventData)
            => ForwardPointer("click", eventData);

        public void OnPointerDown(PointerEventData eventData)
            => ForwardPointer("pointerdown", eventData);

        public void OnPointerUp(PointerEventData eventData)
            => ForwardPointer("pointerup", eventData);

        public void OnPointerMove(PointerEventData eventData)
            => ForwardPointer("pointermove", eventData);

        private void ForwardPointer(string type, PointerEventData eventData)
        {
            if (_forwarder == null) return;
            int nodeId = _forwarder.HitTest(eventData.position);
            if (nodeId == -1) return;
            _forwarder.ForwardPointerEvent(
                type, nodeId,
                eventData.position.x, eventData.position.y,
                (int)eventData.button, eventData.pointerId);
        }
    }
}
