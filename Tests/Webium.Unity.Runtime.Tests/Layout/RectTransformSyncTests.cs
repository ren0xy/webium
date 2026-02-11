using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Layout;
using Webium.Unity;

namespace Webium.Tests.Layout
{
    [TestFixture]
    public class RectTransformSyncTests
    {
        private GameObject _go;
        private RectTransform _rt;

        [SetUp]
        public void SetUp()
        {
            _go = new GameObject("TestRT");
            _rt = _go.AddComponent<RectTransform>();
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_go);
        }

        // --- ApplyToRectTransform ---

        [Test]
        public void ApplyToRectTransform_SetsAnchorsToTopLeft()
        {
            RectTransformSync.ApplyToRectTransform(_rt, 0f, 0f, 100f, 50f);

            Assert.AreEqual(new Vector2(0f, 1f), _rt.anchorMin);
            Assert.AreEqual(new Vector2(0f, 1f), _rt.anchorMax);
        }

        [Test]
        public void ApplyToRectTransform_SetsPivotToTopLeft()
        {
            RectTransformSync.ApplyToRectTransform(_rt, 0f, 0f, 100f, 50f);

            Assert.AreEqual(new Vector2(0f, 1f), _rt.pivot);
        }

        [Test]
        public void ApplyToRectTransform_SetsAnchoredPosition_LeftNegTop()
        {
            RectTransformSync.ApplyToRectTransform(_rt, 30f, 20f, 100f, 50f);

            Assert.AreEqual(new Vector2(30f, -20f), _rt.anchoredPosition);
        }

        [Test]
        public void ApplyToRectTransform_SetsSizeDelta()
        {
            RectTransformSync.ApplyToRectTransform(_rt, 10f, 5f, 200f, 150f);

            Assert.AreEqual(new Vector2(200f, 150f), _rt.sizeDelta);
        }

        [Test]
        public void ApplyToRectTransform_ZeroValues()
        {
            RectTransformSync.ApplyToRectTransform(_rt, 0f, 0f, 0f, 0f);

            Assert.AreEqual(new Vector2(0f, 0f), _rt.anchoredPosition);
            Assert.AreEqual(new Vector2(0f, 0f), _rt.sizeDelta);
        }

        [Test]
        public void ApplyToRectTransform_NullRectTransform_DoesNotThrow()
        {
            Assert.DoesNotThrow(() =>
                RectTransformSync.ApplyToRectTransform(null, 10f, 20f, 100f, 50f));
        }

        // --- ApplyLayout tree walk ---

        [Test]
        public void ApplyLayout_NullRoot_DoesNotThrow()
        {
            var sync = new RectTransformSync();
            var mgr = new YogaTreeManager();

            Assert.DoesNotThrow(() => sync.ApplyLayout(null, mgr));
        }

        [Test]
        public void ApplyLayout_NullTreeManager_DoesNotThrow()
        {
            var sync = new RectTransformSync();
            var dom = new VirtualDOM();

            Assert.DoesNotThrow(() => sync.ApplyLayout(dom.Root, null));
        }

        [Test]
        public void ApplyLayout_NodeWithoutBacking_DoesNotThrow()
        {
            var sync = new RectTransformSync();
            var dom = new VirtualDOM();
            var mgr = new YogaTreeManager();
            mgr.SyncTree(dom.Root);

            // Root has no RenderHandle — should skip gracefully
            Assert.DoesNotThrow(() => sync.ApplyLayout(dom.Root, mgr));
        }
    }
}
