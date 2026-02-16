using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime
{
    /// <summary>
    /// Unit tests for WebiumSurface.
    /// Requirements: 9.1, 9.2, 9.3
    ///
    /// WebiumSurface.Awake() creates Canvas/CanvasScaler/Root before instantiating
    /// the JS runtime (UnityPuerTSRuntime), which may throw in test environments.
    /// We catch the exception and verify the structures created before it.
    /// </summary>
    [TestFixture]
    public class WebiumSurfaceTests
    {
        private GameObject _surfaceGo;

        [SetUp]
        public void SetUp()
        {
            _surfaceGo = new GameObject("TestSurface");
            try
            {
                _surfaceGo.AddComponent<WebiumSurface>();
            }
            catch (System.Exception)
            {
                // Expected: UnityPuerTSRuntime constructor may fail in test environment
                // (PuerTS JsEnv not available). Canvas, CanvasScaler, root RectTransform
                // are created before that call.
            }
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_surfaceGo);
        }

        [Test]
        public void Awake_CreatesCanvasWithScreenSpaceOverlay()
        {
            var canvasTransform = _surfaceGo.transform.Find("WebiumCanvas");
            Assert.IsNotNull(canvasTransform, "WebiumCanvas child should exist");

            var canvas = canvasTransform.GetComponent<Canvas>();
            Assert.IsNotNull(canvas, "Canvas component should exist");
            Assert.AreEqual(RenderMode.ScreenSpaceOverlay, canvas.renderMode);
        }

        [Test]
        public void Awake_CanvasScalerSetToScaleWithScreenSize()
        {
            var canvasTransform = _surfaceGo.transform.Find("WebiumCanvas");
            Assert.IsNotNull(canvasTransform);

            var scaler = canvasTransform.GetComponent<CanvasScaler>();
            Assert.IsNotNull(scaler, "CanvasScaler component should exist");
            Assert.AreEqual(CanvasScaler.ScaleMode.ScaleWithScreenSize, scaler.uiScaleMode);
            Assert.AreEqual(new Vector2(1920, 1080), scaler.referenceResolution);
        }

        [Test]
        public void Awake_CanvasHasGraphicRaycaster()
        {
            var canvasTransform = _surfaceGo.transform.Find("WebiumCanvas");
            Assert.IsNotNull(canvasTransform);

            Assert.IsNotNull(
                canvasTransform.GetComponent<GraphicRaycaster>(),
                "GraphicRaycaster should be attached to canvas");
        }

        [Test]
        public void Awake_RootRectTransformHasCorrectAnchors()
        {
            var canvasTransform = _surfaceGo.transform.Find("WebiumCanvas");
            Assert.IsNotNull(canvasTransform);

            var rootTransform = canvasTransform.Find("WebiumRoot");
            Assert.IsNotNull(rootTransform, "WebiumRoot child should exist");

            var rt = rootTransform.GetComponent<RectTransform>();
            Assert.IsNotNull(rt, "RectTransform should exist on root");
            Assert.AreEqual(Vector2.zero, rt.anchorMin);
            Assert.AreEqual(Vector2.one, rt.anchorMax);
            Assert.AreEqual(Vector2.zero, rt.sizeDelta);
        }

        [Test]
        public void Awake_HasAddComponentMenuAttribute()
        {
            var attr = System.Attribute.GetCustomAttribute(
                typeof(WebiumSurface),
                typeof(AddComponentMenu)) as AddComponentMenu;

            Assert.IsNotNull(attr, "WebiumSurface should have [AddComponentMenu]");
        }
    }
}
