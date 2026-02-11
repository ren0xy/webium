using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for ComponentRenderer.
    /// Requirements: 1.3, 8.3
    /// </summary>
    [TestFixture]
    public class ComponentRendererTests
    {
        private class RecordingLogger : ILogger
        {
            public List<string> Warnings { get; } = new List<string>();
            public List<Exception> Exceptions { get; } = new List<Exception>();
            public void LogWarning(string message) => Warnings.Add(message);
            public void LogException(Exception exception) => Exceptions.Add(exception);
        }

        private class SpyRenderer : ITagRenderer
        {
            public int SyncCount;
            public void Sync(VirtualNode node) => SyncCount++;
        }

        private RecordingLogger _logger;
        private ComponentRenderer _cr;
        private VirtualDOM _dom;

        [SetUp]
        public void SetUp()
        {
            _logger = new RecordingLogger();
            _cr = new ComponentRenderer(_logger);
            _dom = new VirtualDOM();
        }

        // ── Unknown tag logs warning and skips (Req 1.3) ──

        [Test]
        public void SyncVisuals_UnknownTag_LogsWarning()
        {
            var node = _dom.CreateElement(NodeTag.Unknown);
            var go = new GameObject("TestUnknown");
            node.RenderHandle = go;
            node.MarkDirty(DirtyFlags.All);

            try
            {
                _cr.SyncVisuals(new List<VirtualNode> { node });
                Assert.AreEqual(1, _logger.Warnings.Count);
                StringAssert.Contains("No renderer registered", _logger.Warnings[0]);
            }
            finally
            {
                Object.DestroyImmediate(go);
            }
        }

        // ── Null RenderHandle logs warning and skips (Req 1.3) ──

        [Test]
        public void SyncVisuals_NullRenderHandle_LogsWarning()
        {
            var node = _dom.CreateElement(NodeTag.Div);
            // RenderHandle is null by default
            node.MarkDirty(DirtyFlags.All);

            _cr.SyncVisuals(new List<VirtualNode> { node });

            Assert.AreEqual(1, _logger.Warnings.Count);
            StringAssert.Contains("null RenderHandle", _logger.Warnings[0]);
        }

        // ── RegisterRenderer replaces existing renderer (Req 8.3) ──

        [Test]
        public void RegisterRenderer_ReplacesExisting()
        {
            var spy = new SpyRenderer();
            _cr.RegisterRenderer(NodeTag.Div, spy);

            var node = _dom.CreateElement(NodeTag.Div);
            var go = new GameObject("TestReplace");
            node.RenderHandle = go;
            node.MarkDirty(DirtyFlags.All);

            try
            {
                _cr.SyncVisuals(new List<VirtualNode> { node });
                Assert.AreEqual(1, spy.SyncCount);
            }
            finally
            {
                Object.DestroyImmediate(go);
            }
        }

        // ── ArgumentNullException on null list ──

        [Test]
        public void SyncVisuals_NullList_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() => _cr.SyncVisuals(null));
        }

        // ── ArgumentNullException on null renderer ──

        [Test]
        public void RegisterRenderer_NullRenderer_ThrowsArgumentNullException()
        {
            Assert.Throws<ArgumentNullException>(() =>
                _cr.RegisterRenderer(NodeTag.Div, null));
        }
    }
}
