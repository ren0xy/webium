#if !UNITY_WEBGL
using System;
using System.Collections.Generic;
using Puerts;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Real <see cref="IJSRuntime"/> implementation for desktop/mobile Unity builds.
    /// Wraps <see cref="Puerts.JsEnv"/> to execute JavaScript, marshal ArrayBuffer ↔ byte[],
    /// and expose C# delegates as JS-callable globals.
    /// <para>
    /// Lives in <c>Webium.Unity.Runtime</c> (not <c>Webium.JSRuntime</c>) because PuerTS
    /// is a Unity-specific dependency. The stub <c>PuerTSRuntime</c> in <c>Webium.JSRuntime</c>
    /// remains for the <c>dotnet test</c> pipeline.
    /// </para>
    /// </summary>
    public class UnityPuerTSRuntime : IJSRuntime
    {
        private JsEnv _jsEnv;
        private bool _disposed;

        /// <summary>
        /// Static registry of C# delegates exposed to JS via <see cref="RegisterBinding"/>.
        /// JS code retrieves these by calling <c>CS.Webium.Unity.UnityPuerTSRuntime.GetBinding(name)</c>.
        /// </summary>
        private static readonly Dictionary<string, Delegate> _bindings = new Dictionary<string, Delegate>();

        /// <inheritdoc />
        public bool IsReady => _jsEnv != null && !_disposed;

        /// <summary>
        /// Creates a new PuerTS JS environment.
        /// </summary>
        public UnityPuerTSRuntime()
        {
            _jsEnv = new JsEnv();
        }

        /// <inheritdoc />
        public object Evaluate(string script)
        {
            ThrowIfDisposed();
            return _jsEnv.Eval<object>(script);
        }

        /// <inheritdoc />
        public object CallFunction(string name, params object[] args)
        {
            ThrowIfDisposed();
            var argsExpr = BuildArgsExpression(args);
            return _jsEnv.Eval<object>($"globalThis[\"{EscapeJsString(name)}\"]({argsExpr})");
        }

        /// <inheritdoc />
        public T CallFunction<T>(string name, params object[] args)
        {
            ThrowIfDisposed();
            var argsExpr = BuildArgsExpression(args);
            var result = _jsEnv.Eval<object>($"globalThis[\"{EscapeJsString(name)}\"]({argsExpr})");

            // PuerTS returns JS ArrayBuffer/Uint8Array as Puerts.ArrayBuffer, not byte[].
            // Extract the underlying byte[] when the caller expects it.
            if (result is Puerts.ArrayBuffer ab && typeof(T) == typeof(byte[]))
                return (T)(object)ab.Bytes;

            if (result is T typed)
                return typed;

            return default;
        }

        /// <inheritdoc />
        public void RegisterBinding(string name, Delegate callback)
        {
            ThrowIfDisposed();
            _bindings[name] = callback;
            // Expose the delegate to JS via the static registry.
            // JS can call it through: CS.Webium.Unity.UnityPuerTSRuntime.InvokeBinding(name, arg)
            // We assign a JS wrapper function to globalThis[name].
            _jsEnv.Eval<object>(
                $"globalThis[\"{EscapeJsString(name)}\"] = function() {{ " +
                $"  var args = Array.prototype.slice.call(arguments); " +
                $"  return CS.Webium.Unity.UnityPuerTSRuntime.InvokeBinding(\"{EscapeJsString(name)}\", args.length > 0 ? args[0] : null); " +
                $"}}");
        }

        /// <inheritdoc />
        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _jsEnv?.Dispose();
            _jsEnv = null;
        }

        /// <summary>
        /// Called from JS to invoke a registered C# binding by name.
        /// PuerTS makes this accessible as <c>CS.Webium.Unity.UnityPuerTSRuntime.InvokeBinding(name, arg)</c>.
        /// </summary>
        public static object InvokeBinding(string name, object arg)
        {
            if (!_bindings.TryGetValue(name, out var callback))
                throw new InvalidOperationException($"No binding registered with name '{name}'");

            // Invoke the delegate with the provided argument (or no args if null)
            if (arg == null)
                return callback.DynamicInvoke();

            return callback.DynamicInvoke(arg);
        }

        private void ThrowIfDisposed()
        {
            if (_disposed)
                throw new ObjectDisposedException(nameof(UnityPuerTSRuntime));
        }

        /// <summary>
        /// Builds a JS argument expression from C# args for use in Eval.
        /// </summary>
        private static string BuildArgsExpression(object[] args)
        {
            if (args == null || args.Length == 0)
                return string.Empty;

            var parts = new string[args.Length];
            for (int i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg == null)
                    parts[i] = "null";
                else if (arg is string s)
                    parts[i] = "\"" + EscapeJsString(s) + "\"";
                else if (arg is bool b)
                    parts[i] = b ? "true" : "false";
                else
                    parts[i] = arg.ToString();
            }
            return string.Join(",", parts);
        }

        /// <summary>
        /// Escapes a string for safe embedding in a JS string literal.
        /// </summary>
        private static string EscapeJsString(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;

            var sb = new System.Text.StringBuilder(s.Length);
            foreach (var c in s)
            {
                switch (c)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default: sb.Append(c); break;
                }
            }
            return sb.ToString();
        }
    }
}
#endif
