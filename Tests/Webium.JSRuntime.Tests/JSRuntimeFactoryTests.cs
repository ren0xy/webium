using System;
using NUnit.Framework;
using Webium.JSRuntime;

namespace Webium.Tests.JSRuntime
{
    /// <summary>
    /// Unit tests for JSRuntimeFactory platform backend selection.
    /// Feature: js-runtime-service
    /// </summary>
    [TestFixture]
    public class JSRuntimeFactoryTests
    {
        /// <summary>
        /// In editor (non-WebGL), Create() returns a PuerTSRuntime instance.
        /// **Validates: Requirements 9.2, 9.3**
        /// </summary>
        [Test]
        public void Create_NonWebGL_ReturnsPuerTSRuntime()
        {
            IJSRuntime runtime = JSRuntimeFactory.Create();
            try
            {
                Assert.That(runtime, Is.Not.Null, "Factory must return a non-null runtime");
                Assert.That(runtime, Is.InstanceOf<IJSRuntime>(),
                    "Returned object must implement IJSRuntime");
                Assert.That(runtime, Is.InstanceOf<PuerTSRuntime>(),
                    "Non-WebGL build should return PuerTSRuntime");
            }
            finally
            {
                runtime.Dispose();
            }
        }

        /// <summary>
        /// Verifies the factory returns a disposable runtime (IJSRuntime extends IDisposable).
        /// **Validates: Requirements 9.1**
        /// </summary>
        [Test]
        public void Create_ReturnsDisposableRuntime()
        {
            var runtime = JSRuntimeFactory.Create();
            Assert.That(runtime, Is.InstanceOf<IDisposable>(),
                "IJSRuntime extends IDisposable");
            runtime.Dispose();
        }
    }
}
