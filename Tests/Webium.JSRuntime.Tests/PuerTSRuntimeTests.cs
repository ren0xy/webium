using System;
using FsCheck;
using FsCheck.NUnit;
using NUnit.Framework;
using Webium.JSRuntime;

namespace Webium.Tests.JSRuntime
{
    /// <summary>
    /// Property-based tests for PuerTSRuntime.
    /// Feature: js-runtime-service, Property 1: Disposed runtime invariant
    /// </summary>
    [TestFixture]
    public class PuerTSRuntimeTests
    {
        /// <summary>
        /// Property 1: Disposed runtime invariant
        /// For any PuerTSRuntime implementation, after Dispose() is called,
        /// IsReady shall return false, and any subsequent call to Evaluate or
        /// CallFunction shall throw ObjectDisposedException for any random
        /// script/function name.
        /// **Validates: Requirements 1.7, 4.6, 4.7**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100)]
        public FsCheck.Property DisposedRuntime_IsNotReady_AndThrowsOnUse(NonNull<string> script, NonNull<string> functionName)
        {
            var runtime = new PuerTSRuntime();
            runtime.Dispose();

            var isReadyFalse = !runtime.IsReady;

            var evaluateThrows = false;
            try
            {
                runtime.Evaluate(script.Get);
            }
            catch (ObjectDisposedException)
            {
                evaluateThrows = true;
            }

            var callFunctionThrows = false;
            try
            {
                runtime.CallFunction(functionName.Get);
            }
            catch (ObjectDisposedException)
            {
                callFunctionThrows = true;
            }

            return (isReadyFalse && evaluateThrows && callFunctionThrows)
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 1: Disposed runtime invariant");
        }
    }
}
