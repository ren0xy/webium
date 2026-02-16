#if !UNITY_WEBGL
using System;

namespace Webium.JSRuntime
{
    /// <summary>
    /// <see cref="IJSRuntime"/> implementation for desktop and mobile builds.
    /// Wraps PuerTS (V8 or QuickJS) to provide JS execution.
    /// Conditionally compiled out of WebGL builds via <c>#if !UNITY_WEBGL</c>.
    /// </summary>
    public class PuerTSRuntime : IJSRuntime
    {
        private object _jsEnv; // Puerts.JsEnv — typed loosely to avoid hard reference until PuerTS package is installed
        private bool _disposed;

        /// <inheritdoc />
        public bool IsReady => _jsEnv != null && !_disposed;

        /// <summary>
        /// Initializes a new PuerTS JS environment.
        /// Full PuerTS wiring is deferred to the dedicated JS Runtime Service spec
        /// (006-js-runtime-service); this class provides the structural scaffold.
        /// </summary>
        public PuerTSRuntime()
        {
            // TODO: Initialize Puerts.JsEnv when PuerTS package is available
            // _jsEnv = new Puerts.JsEnv();
        }

        /// <inheritdoc />
        public object Evaluate(string script)
        {
            ThrowIfDisposed();
            // TODO: return _jsEnv.Eval<object>(script);
            return null;
        }

        /// <inheritdoc />
        public object CallFunction(string name, params object[] args)
        {
            ThrowIfDisposed();
            // TODO: invoke via PuerTS function call API
            return null;
        }

        /// <inheritdoc />
        public T CallFunction<T>(string name, params object[] args)
        {
            ThrowIfDisposed();
            // TODO: invoke via PuerTS function call API with typed return
            return default;
        }

        /// <inheritdoc />
        public void RegisterBinding(string name, Delegate callback)
        {
            ThrowIfDisposed();
            // TODO: register C# callback with PuerTS so JS can call it by name
        }

        /// <inheritdoc />
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            // TODO: (_jsEnv as IDisposable)?.Dispose();
            _jsEnv = null;
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
                throw new ObjectDisposedException(nameof(PuerTSRuntime));
        }
    }
}
#endif
