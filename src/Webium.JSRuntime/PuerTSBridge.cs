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
        private readonly IJSRuntime _runtime;
        private Action<MutationBatch> _mutationHandler;
        private readonly List<(string messageType, object payload)> _outboundQueue
            = new List<(string, object)>();

        public PuerTSBridge(IJSRuntime runtime)
        {
            _runtime = runtime;
        }

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
            // Use typed CallFunction<byte[]> so PuerTS marshals Uint8Array → byte[] directly
            var result = _runtime.CallFunction<byte[]>("tick");
            return result ?? Array.Empty<byte>();
        }

        /// <inheritdoc />
        public void ForwardInputEvent(string serializedEvent)
        {
            _runtime.CallFunction("handleInputEvent", serializedEvent);
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
