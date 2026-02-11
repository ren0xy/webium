using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers.Properties
{
    /// <summary>
    /// Property-based tests for ComponentRenderer dispatcher.
    /// Validates: Requirements 1.2, 1.4
    /// </summary>
    [TestFixture]
    public class DispatcherProperties
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
            public List<int> SyncedNodeIds { get; } = new List<int>();
            public void Sync(VirtualNode node) => SyncedNodeIds.Add(node.Id);
        }

        private class ThrowingRenderer : ITagRenderer
        {
            public void Sync(VirtualNode node) =>
                throw new InvalidOperationException("Boom");
        }

        private static readonly NodeTag[] KnownTags =
            { NodeTag.Div, NodeTag.Img, NodeTag.Span, NodeTag.P, NodeTag.Text };

        private static Gen<NodeTag> GenKnownTag =>
            Gen.Elements(KnownTags);

        private static Gen<int> GenNodeCount =>
            Gen.Choose(1, 10);

        /// <summary>
        /// Property 1: Dispatcher routes nodes to correct tag-specific renderer.
        /// For any sequence of nodes with known tags, each node is dispatched
        /// to the renderer registered for that tag.
        /// **Validates: Requirements 1.2**
        /// </summary>
        [Test]
        public void Property1_RoutesToCorrectRenderer()
        {
            Prop.ForAll(
                GenNodeCount.ToArbitrary(),
                count =>
                {
                    var logger = new RecordingLogger();
                    var cr = new ComponentRenderer(logger);

                    // Replace all default renderers with spies
                    var spies = new Dictionary<NodeTag, SpyRenderer>();
                    foreach (var tag in KnownTags)
                    {
                        var spy = new SpyRenderer();
                        spies[tag] = spy;
                        cr.RegisterRenderer(tag, spy);
                    }

                    var dom = new VirtualDOM();
                    var nodes = new List<VirtualNode>();
                    var gameObjects = new List<GameObject>();

                    try
                    {
                        for (int i = 0; i < count; i++)
                        {
                            // Cycle through known tags
                            var tag = KnownTags[i % KnownTags.Length];
                            var node = dom.CreateElement(tag);
                            var go = new GameObject($"PBT_{i}");
                            node.RenderHandle = go;
                            node.MarkDirty(DirtyFlags.All);
                            nodes.Add(node);
                            gameObjects.Add(go);
                        }

                        cr.SyncVisuals(nodes);

                        // Verify each node was dispatched to the correct spy
                        foreach (var node in nodes)
                        {
                            var spy = spies[node.Tag];
                            if (!spy.SyncedNodeIds.Contains(node.Id))
                                return false.Label($"Node {node.Id} (tag={node.Tag}) not dispatched to correct renderer");
                        }

                        return true.Label("All nodes routed correctly");
                    }
                    finally
                    {
                        foreach (var go in gameObjects)
                            Object.DestroyImmediate(go);
                    }
                }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 2: Exception isolation in dispatcher.
        /// If one renderer throws, all other nodes are still processed.
        /// **Validates: Requirements 1.4**
        /// </summary>
        [Test]
        public void Property2_ExceptionIsolation()
        {
            Prop.ForAll(
                Gen.Choose(2, 8).ToArbitrary(),
                count =>
                {
                    var logger = new RecordingLogger();
                    var cr = new ComponentRenderer(logger);

                    // Make Div throw, use spy for Span
                    var throwingRenderer = new ThrowingRenderer();
                    var spy = new SpyRenderer();
                    cr.RegisterRenderer(NodeTag.Div, throwingRenderer);
                    cr.RegisterRenderer(NodeTag.Span, spy);

                    var dom = new VirtualDOM();
                    var nodes = new List<VirtualNode>();
                    var gameObjects = new List<GameObject>();
                    int expectedSpanCount = 0;

                    try
                    {
                        for (int i = 0; i < count; i++)
                        {
                            // Alternate Div (throws) and Span (spy)
                            var tag = i % 2 == 0 ? NodeTag.Div : NodeTag.Span;
                            var node = dom.CreateElement(tag);
                            var go = new GameObject($"PBT_{i}");
                            node.RenderHandle = go;
                            node.MarkDirty(DirtyFlags.All);
                            nodes.Add(node);
                            gameObjects.Add(go);
                            if (tag == NodeTag.Span) expectedSpanCount++;
                        }

                        cr.SyncVisuals(nodes);

                        var spansProcessed = spy.SyncedNodeIds.Count == expectedSpanCount;
                        var exceptionsLogged = logger.Exceptions.Count > 0;

                        return (spansProcessed && exceptionsLogged)
                            .Label($"spans={spy.SyncedNodeIds.Count}/{expectedSpanCount} exceptions={logger.Exceptions.Count}");
                    }
                    finally
                    {
                        foreach (var go in gameObjects)
                            Object.DestroyImmediate(go);
                    }
                }).QuickCheckThrowOnFailure();
        }
    }
}
