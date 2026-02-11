using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for ImageRenderer.
    /// Requirements: 3.1, 3.6, 3.7, 3.8
    /// </summary>
    [TestFixture]
    public class ImageRendererTests
    {
        private ImageRenderer _renderer;
        private VirtualDOM _dom;
        private GameObject _go;

        [SetUp]
        public void SetUp()
        {
            _renderer = new ImageRenderer();
            _dom = new VirtualDOM();
            _go = new GameObject("TestImg");
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_go);
        }

        // ── RawImage component creation (Req 3.1) ──

        [Test]
        public void Sync_CreatesRawImageComponent()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Attributes);
            node.Attributes["src"] = "Resources/test";

            _renderer.Sync(node);

            Assert.IsNotNull(_go.GetComponent<RawImage>());
        }

        [Test]
        public void Sync_CreatesImageSourceTracker()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Attributes);
            node.Attributes["src"] = "Resources/test";

            _renderer.Sync(node);

            Assert.IsNotNull(_go.GetComponent<ImageSourceTracker>());
        }

        // ── Early exit when DirtyFlags.Attributes not set (Req 3.8) ──

        [Test]
        public void Sync_AttributesNotDirty_SkipsUpdate()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.Dirty = DirtyFlags.None;
            node.Attributes["src"] = "Resources/test";

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<RawImage>());
        }

        // ── Src removal sets texture to null (Req 3.6) ──

        [Test]
        public void Sync_SrcRemoved_SetsTextureNull()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Attributes);
            // No src attribute set — simulates removal

            _renderer.Sync(node);

            var rawImage = _go.GetComponent<RawImage>();
            Assert.IsNotNull(rawImage);
            Assert.IsNull(rawImage.texture);
        }

        [Test]
        public void Sync_SrcEmpty_SetsTextureNull()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Attributes);
            node.Attributes["src"] = "";

            _renderer.Sync(node);

            var rawImage = _go.GetComponent<RawImage>();
            Assert.IsNotNull(rawImage);
            Assert.IsNull(rawImage.texture);
        }

        // ── Tag guard: non-Img nodes skipped (Req 3.7) ──

        [Test]
        public void Sync_NonImgTag_Skipped()
        {
            var node = _dom.CreateElement(NodeTag.Div);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Attributes);
            node.Attributes["src"] = "Resources/test";

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<RawImage>());
        }

        [Test]
        public void Sync_SpanTag_Skipped()
        {
            var node = _dom.CreateElement(NodeTag.Span);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Attributes);
            node.Attributes["src"] = "Resources/test";

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<RawImage>());
        }
    }
}
