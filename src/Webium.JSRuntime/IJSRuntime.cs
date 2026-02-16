using System;

namespace Webium.JSRuntime
{
    /// <summary>
    /// Abstracts JS engine operations behind a unified interface.
    /// All consumers (Web UI Core, Browser API, Modding Runtime) depend on
    /// this interface — never on PuerTS or browser APIs directly.
    ///
    /// <para><b>Implementations:</b></para>
    /// <list type="bullet">
    ///   <item><description>
    ///     <c>PuerTSRuntime</c> — desktop/mobile builds, wraps PuerTS (V8/QuickJS).
    ///     Conditionally compiled with <c>#if !UNITY_WEBGL</c>.
    ///   </description></item>
    ///   <item><description>
    ///     <c>BrowserRuntime</c> — WebGL builds, uses jslib interop to talk to
    ///     the browser's native JS engine. No V8, no QuickJS, no PuerTS.
    ///     Conditionally compiled with <c>#if UNITY_WEBGL</c>.
    ///   </description></item>
    /// </list>
    /// </summary>
    public interface IJSRuntime : IDisposable
    {
        /// <summary>
        /// Evaluates a JS script and returns the result.
        /// </summary>
        /// <param name="script">The JavaScript source to evaluate.</param>
        /// <returns>The evaluation result, or null if the script produces no value.</returns>
        object Evaluate(string script);

        /// <summary>
        /// Calls a named JS function with the supplied arguments.
        /// </summary>
        /// <param name="name">The global function name to invoke.</param>
        /// <param name="args">Arguments passed to the function.</param>
        /// <returns>The function's return value, or null.</returns>
        object CallFunction(string name, params object[] args);

        /// <summary>
        /// Calls a named JS function and marshals the result to <typeparamref name="T"/>.
        /// Use when the return type is known (e.g. <c>byte[]</c> for typed arrays).
        /// </summary>
        T CallFunction<T>(string name, params object[] args);

        /// <summary>
        /// Registers a C# delegate as a JS-callable binding.
        /// </summary>
        /// <param name="name">The name exposed to JS.</param>
        /// <param name="callback">The C# delegate to invoke when JS calls this binding.</param>
        void RegisterBinding(string name, Delegate callback);

        /// <summary>
        /// Whether this runtime is initialized and ready to execute scripts.
        /// </summary>
        bool IsReady { get; }
    }
}
