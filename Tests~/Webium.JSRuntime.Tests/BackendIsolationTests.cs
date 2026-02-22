using System.IO;
using System.Linq;
using NUnit.Framework;

namespace Webium.Tests.JSRuntime
{
    /// <summary>
    /// Unit tests verifying backend isolation at the source level.
    /// Property 8: IJSRuntime backend isolation.
    /// BrowserRuntime has zero PuerTS references; PuerTSRuntime has zero jslib references.
    /// Feature: architecture-refactor
    /// **Validates: Requirements 10.5, 11.1, 11.2**
    /// </summary>
    [TestFixture]
    public class BackendIsolationTests
    {
        private static string JSRuntimeDir =>
            Path.GetFullPath(Path.Combine(TestContext.CurrentContext.TestDirectory,
                "..", "..", "..", "..", "..", "src", "Webium.JSRuntime"));

        [Test]
        public void BrowserRuntime_HasZeroPuerTSReferences()
        {
            var path = Path.Combine(JSRuntimeDir, "BrowserRuntime.cs");
            Assert.That(File.Exists(path), Is.True, $"BrowserRuntime.cs not found at {path}");

            var content = File.ReadAllText(path);
            Assert.That(content, Does.Not.Contain("Puerts"),
                "BrowserRuntime must not reference PuerTS");
            Assert.That(content, Does.Not.Contain("JsEnv"),
                "BrowserRuntime must not reference PuerTS JsEnv");
        }

        [Test]
        public void PuerTSRuntime_HasZeroJslibReferences()
        {
            var path = Path.Combine(JSRuntimeDir, "PuerTSRuntime.cs");
            Assert.That(File.Exists(path), Is.True, $"PuerTSRuntime.cs not found at {path}");

            var content = File.ReadAllText(path);
            Assert.That(content, Does.Not.Contain("DllImport"),
                "PuerTSRuntime must not use DllImport (jslib interop)");
            Assert.That(content, Does.Not.Contain("__Internal"),
                "PuerTSRuntime must not reference __Internal (jslib)");
            Assert.That(content, Does.Not.Contain(".jslib"),
                "PuerTSRuntime must not reference jslib files");
        }

        [Test]
        public void BrowserRuntime_ConditionallyCompiledForWebGL()
        {
            var path = Path.Combine(JSRuntimeDir, "BrowserRuntime.cs");
            var lines = File.ReadAllLines(path);
            Assert.That(lines.First().Trim(), Is.EqualTo("#if UNITY_WEBGL"),
                "BrowserRuntime must be wrapped in #if UNITY_WEBGL");
        }

        [Test]
        public void PuerTSRuntime_ConditionallyExcludedFromWebGL()
        {
            var path = Path.Combine(JSRuntimeDir, "PuerTSRuntime.cs");
            var lines = File.ReadAllLines(path);
            Assert.That(lines.First().Trim(), Is.EqualTo("#if !UNITY_WEBGL"),
                "PuerTSRuntime must be wrapped in #if !UNITY_WEBGL");
        }
    }
}
