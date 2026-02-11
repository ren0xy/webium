#if !UNITY_WEBGL
using System;
using System.Collections.Generic;

namespace Webium.JSRuntime
{
    /// <summary>
    /// <see cref="IJSBridge"/> implementation for desktop and mobile builds.
    /// Uses PuerTS interop for JS↔C# mutation marshalling.
    /// Conditionally compiled out of WebGL builds via <c>#if !UNITY_WEBGL</c>.
    /// </summary>
    public class PuerTSBridge : IJSBridge
    {
        private Action<MutationBatch> _mutationHandler;
        private readonly List<(string messageType, object payload)> _outboundQueue
            = new List<(string, object)>();

        /// <inheritdoc />
        public void OnMutation(Action<MutationBatch> handler)
        {
            _mutationHandler = handler;
        }

        /// <inheritdoc />
        public void PostToJS(string messageType, object payload)
        {
            _outboundQueue.Add((messageType, payload));
        }

        /// <inheritdoc />
        public void Flush()
        {
            if (_outboundQueue.Count == 0) return;

            // TODO: Marshal queued messages to PuerTS JS environment
            // foreach (var (type, payload) in _outboundQueue)
            //     _jsEnv.CallFunction("__webium_receive", type, payload);

            _outboundQueue.Clear();
        }

        /// <inheritdoc />
        public byte[] CallTick()
        {
            // TODO: Call JS-side tick() via PuerTS and return the serialized RenderCommandBuffer
            return Array.Empty<byte>();
        }

        /// <inheritdoc />
        public void ForwardInputEvent(string serializedEvent)
        {
            // TODO: Forward serialized InputEvent to JS-side InputEventHandler via PuerTS
        }

        /// <summary>
        /// Called by PuerTS when the JS side dispatches a mutation batch.
        /// Wired up during runtime initialization.
        /// </summary>
        internal void ReceiveMutations(MutationBatch batch)
        {
            _mutationHandler?.Invoke(batch);
        }
    }
}
#endif
