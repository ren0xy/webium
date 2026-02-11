using NUnit.Framework;
using TMPro;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for TextRenderer.
    /// Requirements: 4.5, 4.6, 4.7
    /// </summary>
    [TestFixture]
    public class TextRendererTests
    {
        private TextRenderer _renderer;
        private VirtualDOM _dom;
        private GameObject _go;

        [SetUp]
        public void SetUp()
        {
            _renderer = new TextRenderer();
            _dom = new VirtualDOM();
            _go = new GameObject("TestText");
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_go);
        }

        // ── TMP component creation ──

        [Test]
        public void Sync_CreatesTMPComponent()
        {
            var node = _dom.CreateElement(NodeTag.Span);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Text);
            node.TextContent = "hello";

            _renderer.Sync(node);

            Assert.IsNotNull(_go.GetComponent<TextMeshProUGUI>());
        }

        // ── Text-align mapping (Req 4.5) ──

        [TestCase("left", TextAlignmentOptions.Left)]
        [TestCase("center", TextAlignmentOptions.Center)]
        [TestCase("right", TextAlignmentOptions.Right)]
        [TestCase("justify", TextAlignmentOptions.Justified)]
        public void Sync_TextAlign_MapsCorrectly(string cssAlign, TextAlignmentOptions expected)
        {
            var node = _dom.CreateElement(NodeTag.P);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Style);
            node.InlineStyles["text-align"] = cssAlign;

            _renderer.Sync(node);

            var tmp = _go.GetComponent<TextMeshProUGUI>();
            Assert.AreEqual(expected, tmp.alignment);
        }

        // ── Early exit when no dirty flags set (Req 4.7) ──

        [Test]
        public void Sync_NoDirtyFlags_SkipsUpdate()
        {
            var node = _dom.CreateElement(NodeTag.Span);
            node.RenderHandle = _go;
            node.Dirty = DirtyFlags.None;
            node.TextContent = "should not render";

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<TextMeshProUGUI>());
        }

        // ── Tag guard: only Span, P, Text accepted (Req 4.6) ──

        [Test]
        public void Sync_SpanTag_Accepted()
        {
            var node = _dom.CreateElement(NodeTag.Span);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Text);

            _renderer.Sync(node);

            Assert.IsNotNull(_go.GetComponent<TextMeshProUGUI>());
        }

        [Test]
        public void Sync_PTag_Accepted()
        {
            var node = _dom.CreateElement(NodeTag.P);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Text);

            _renderer.Sync(node);

            Assert.IsNotNull(_go.GetComponent<TextMeshProUGUI>());
        }

        [Test]
        public void Sync_TextTag_Accepted()
        {
            var node = _dom.CreateTextNode("hello");
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Text);

            _renderer.Sync(node);

            Assert.IsNotNull(_go.GetComponent<TextMeshProUGUI>());
        }

        [Test]
        public void Sync_DivTag_Skipped()
        {
            var node = _dom.CreateElement(NodeTag.Div);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Text | DirtyFlags.Style);

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<TextMeshProUGUI>());
        }

        [Test]
        public void Sync_ImgTag_Skipped()
        {
            var node = _dom.CreateElement(NodeTag.Img);
            node.RenderHandle = _go;
            node.MarkDirty(DirtyFlags.Text | DirtyFlags.Style);

            _renderer.Sync(node);

            Assert.IsNull(_go.GetComponent<TextMeshProUGUI>());
        }
    }
}
