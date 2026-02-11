namespace Webium.Core
{
    /// <summary>
    /// Captures engine-native input events, performs hit-testing to determine
    /// the target nodeId, and forwards them to JS_Core as InputEvents.
    /// </summary>
    public interface IInputEventForwarder
    {
        /// <summary>
        /// Forwards a pointer event (click, pointerdown, pointerup, pointermove)
        /// to JS_Core.
        /// </summary>
        void ForwardPointerEvent(string type, int targetNodeId, float clientX, float clientY, int button, int pointerId);

        /// <summary>
        /// Forwards a focus event (focus, blur, focusin, focusout) to JS_Core.
        /// </summary>
        void ForwardFocusEvent(string type, int targetNodeId, int relatedTargetId);
    }
}
