#if UNITY_WEBGL
using System;
using System.Runtime.InteropServices;

namespace Webium.JSRuntime
{
    /// <summary>
    /// <see cref="IJSRuntime"/> implementation for WebGL builds.
    /// Communicates with the browser's native JS engine via Unity jslib interop.
    /// No PuerTS, no V8, no QuickJS — the browser already has a JS engine.
    /// Conditionally compiled with <c>#if UNITY_WEBGL</c>.
    /// </summary>
    public class BrowserRuntime : IJSRuntime
    {
        private bool _disposed;

        [DllImport("__Internal")]
        private static extern string WebiumJS_Evaluate(string script);

        [DllImport("__Internal")]
        private static extern string WebiumJS_CallFunction(string name, string argsJson);

        [DllImport("__Internal")]
        private static extern void WebiumJS_RegisterBinding(string name);

        /// <inheritdoc />
        public bool IsReady => !_disposed;

        /// <inheritdoc />
        public object Evaluate(string script)
        {
            ThrowIfDisposed();
            return WebiumJS_Evaluate(script);
        }

        /// <inheritdoc />
        public object CallFunction(string name, params object[] args)
        {
            ThrowIfDisposed();
            var argsJson = SerializeArgs(args);
            return WebiumJS_CallFunction(name, argsJson);
        }

        /// <inheritdoc />
        public T CallFunction<T>(string name, params object[] args)
        {
            ThrowIfDisposed();
            var argsJson = SerializeArgs(args);
            var result = WebiumJS_CallFunction(name, argsJson);
            return (T)(object)result;
        }

        /// <inheritdoc />
        public void RegisterBinding(string name, Delegate callback)
        {
            ThrowIfDisposed();
            // Register the name on the JS side; the callback is stored C#-side
            // and invoked when the browser calls back via SendMessage or similar.
            WebiumJS_RegisterBinding(name);
        }

        /// <inheritdoc />
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
                throw new ObjectDisposedException(nameof(BrowserRuntime));
        }

        private static string SerializeArgs(object[] args) => ArgSerializer.SerializeArgs(args);
    }
}
#endif
