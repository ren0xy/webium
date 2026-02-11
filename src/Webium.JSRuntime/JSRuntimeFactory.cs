using System;

namespace Webium.JSRuntime
{
    /// <summary>
    /// Platform-aware factory that selects the correct <see cref="IJSRuntime"/>
    /// backend based on the build target.
    /// <list type="bullet">
    ///   <item><description>WebGL → <c>BrowserRuntime</c> (browser-native JS via jslib)</description></item>
    ///   <item><description>Desktop / Mobile → <c>PuerTSRuntime</c> (V8 or QuickJS via PuerTS)</description></item>
    /// </list>
    /// </summary>
    public static class JSRuntimeFactory
    {
        /// <summary>
        /// Creates the appropriate <see cref="IJSRuntime"/> for the current platform.
        /// </summary>
        /// <returns>A platform-specific <see cref="IJSRuntime"/> instance.</returns>
        /// <exception cref="PlatformNotSupportedException">
        /// Thrown if no backend is available for the current platform.
        /// </exception>
        public static IJSRuntime Create()
        {
#if UNITY_WEBGL
            return new BrowserRuntime();
#elif !UNITY_WEBGL
            return new PuerTSRuntime();
#else
            throw new PlatformNotSupportedException(
                "No JS runtime backend is available for the current platform.");
#endif
        }
    }
}
