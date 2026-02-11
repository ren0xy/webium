using System;

namespace Webium.JSRuntime
{
    /// <summary>
    /// Abstracts the JS↔C# mutation interop layer.
    /// The Web UI Core layer uses this interface to communicate DOM mutations
    /// without knowing whether PuerTS or browser-native JS is underneath.
    ///
    /// <para><b>Implementations:</b></para>
    /// <list type="bullet">
    ///   <item><description>
    ///     <c>PuerTSBridge</c> — desktop/mobile, uses PuerTS interop for marshalling.
    ///   </description></item>
    ///   <item><description>
    ///     <c>BrowserBridge</c> — WebGL, uses jslib plugins to communicate with browser JS.
    ///   </description></item>
    /// </list>
    /// </summary>
    public interface IJSBridge
    {
        /// <summary>
        /// Registers a callback that is invoked when DOM mutations arrive from JS.
        /// </summary>
        /// <param name="handler">The handler to invoke with each mutation batch.</param>
        [Obsolete("Use CallTick() instead. MutationBatch is replaced by RenderCommandBuffer from JS.")]
        void OnMutation(Action<MutationBatch> handler);

        /// <summary>
        /// Queues a C#→JS notification (e.g. layout readback, event dispatch).
        /// </summary>
        /// <param name="messageType">A string identifying the message kind.</param>
        /// <param name="payload">The message payload (serialized by the implementation).</param>
        void PostToJS(string messageType, object payload);

        /// <summary>
        /// Flushes any queued mutations, sending them to the JS side immediately.
        /// </summary>
        [Obsolete("Use CallTick() instead.")]
        void Flush();

        /// <summary>
        /// Calls the JS-side tick() function and returns the serialized
        /// RenderCommandBuffer as a byte array (typed array format).
        /// </summary>
        /// <returns>The serialized RenderCommandBuffer, or empty array if no changes.</returns>
        byte[] CallTick();

        /// <summary>
        /// Forwards an input event to the JS-side InputEventHandler.
        /// </summary>
        /// <param name="serializedEvent">JSON-serialized InputEvent.</param>
        void ForwardInputEvent(string serializedEvent);
    }
}
