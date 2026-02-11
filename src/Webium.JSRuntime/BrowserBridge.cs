#if UNITY_WEBGL
using System;
using System.Runtime.InteropServices;

namespace Webium.JSRuntime
{
    /// <summary>
    /// <see cref="IJSBridge"/> implementation for WebGL builds.
    /// Uses jslib plugins to communicate DOM mutations with browser-side JS.
    /// No PuerTS references — the browser handles all JS execution natively.
    /// Conditionally compiled with <c>#if UNITY_WEBGL</c>.
    /// </summary>
    public class BrowserBridge : IJSBridge
    {
        private Action<MutationBatch> _mutationHandler;

        [DllImport("__Internal")]
        private static extern void WebiumBridge_PostToJS(string messageType, string payloadJson);

        [DllImport("__Internal")]
        private static extern void WebiumBridge_Flush();

        /// <inheritdoc />
        public void OnMutation(Action<MutationBatch> handler)
        {
            _mutationHandler = handler;
        }

        /// <inheritdoc />
        public void PostToJS(string messageType, object payload)
        {
            var json = payload != null ? payload.ToString() : "null";
            WebiumBridge_PostToJS(messageType, json);
        }

        /// <inheritdoc />
        public void Flush()
        {
            WebiumBridge_Flush();
        }

        /// <inheritdoc />
        public byte[] CallTick()
        {
            // TODO: Call JS-side tick() via jslib and return the serialized RenderCommandBuffer
            return Array.Empty<byte>();
        }

        /// <inheritdoc />
        public void ForwardInputEvent(string serializedEvent)
        {
            // TODO: Forward serialized InputEvent to JS-side InputEventHandler via jslib
        }

        /// <summary>
        /// Called from browser JS (via SendMessage or similar) when mutations arrive.
        /// </summary>
        internal void ReceiveMutations(MutationBatch batch)
        {
            _mutationHandler?.Invoke(batch);
        }
    }
}
#endif
