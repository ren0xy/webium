using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for DivRenderer.
    /// Requirements: 2.3, 2.4, 2.5
    /// </summary>
    [TestFixture]
    public class DivRendererTests
    {
        private DivRenderer _renderer;
        private VirtualDOM _dom;
        private GameObject _go;

        [SetUp]
        public void SetUp()
        {
            _renderer = new DivRenderer();
            _dom = new VirtualDOM();
            _go = new GameObject("TestDiv");
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_go);
        }

        // ── Early exit when DirtyFlags.Style not set (Req 2.4) ──

        [Test]
        public void Sync_StyleNotDirty_SkipsUpdate()
        {
            var node = _dom.CreateElement(NodeTag.Div);
            node.RenderHandle = _go;
            node.InlineStyles["background-color"] = "#FF0000";
            // Clear dirty flags — simulate clean node
            node.Dirty = DirtyFlags.None;

            _renderer.Sync(node);

            // No Image should be added since style wasn't dirty
            Assert.IsNull(_go.GetComponent<Image>());
        }

        // ── Image disabled when background-color is transparent (Req 2.3) ──

        [Test]
        public void Sync_TransparentBackground_DisablesImage()
        {
            var node = _dom.CreateElement(NodeTag.Div);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Style);
            node.InlineStyles["background-color"] = "transparent";

            _renderer.Sync(node);

            var image = _go.GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.IsFalse(image.enabled);
        }

        // ── Image disabled when background-color is absent (Req 2.3) ──

        [Test]
        public void Sync_NoBackgroundColor_DisablesImage()
        {
            var node = _dom.CreateElement(NodeTag.Div);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Style);
            // No background-color set

            _renderer.Sync(node);

            var image = _go.GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.IsFalse(image.enabled);
        }

        // ── Tag guard: non-Div nodes skipped (Req 2.5) ──

        [Test]
        public void Sync_NonDivTag_Skipped()
        {
            var node = _dom.CreateElement(NodeTag.Span);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Style);
            node.InlineStyles["background-color"] = "#FF0000";

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<Image>());
        }

        [Test]
        public void Sync_ImgTag_Skipped()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Style);
            node.InlineStyles["background-color"] = "#FF0000";

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<Image>());
        }
    }
}
