using FsCheck;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Layout;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime
{
    /// <summary>
    /// Property-based tests for RectTransformSync.
    /// Requires Unity Test Runner (Edit Mode) — cannot run in standard .NET.
    /// Feature: architecture-refactor
    /// </summary>
    [TestFixture]
    public class RectTransformSyncProperties
    {
        /// <summary>
        /// Property 6: RectTransformSync applies layout via RenderHandle
        /// For any VirtualNode whose RenderHandle is a GameObject with a RectTransform,
        /// and whose YogaNode has computed layout values, ApplyLayout sets
        /// anchoredPosition and sizeDelta to match Yoga-computed values using top-left anchoring.
        /// **Validates: Requirements 7.2**
        /// </summary>
        [Test]
        public void ApplyLayout_SetsRectTransformFromRenderHandle()
        {
            Prop.ForAll(
                GenLayoutValue().ToArbitrary(),
                GenLayoutValue().ToArbitrary(),
                GenPositiveDimension().ToArbitrary(),
                GenPositiveDimension().ToArbitrary(),
                (left, top, width, height) =>
                {
                    var dom = new VirtualDOM();
                    var node = dom.CreateElement(NodeTag.Div);
                    dom.AppendChild(dom.Root, node);

                    // Create a GameObject with RectTransform as the RenderHandle
                    var go = new GameObject("PBT_Node");
                    go.AddComponent<RectTransform>();
                    node.RenderHandle = go;

                    try
                    {
                        // Set up Yoga tree and force layout values
                        var treeManager = new YogaTreeManager();
                        treeManager.SyncTree(dom.Root);
                        var yogaNode = treeManager.GetYogaNode(node);

                        // Set explicit dimensions on the yoga node
                        var rootYoga = treeManager.RootYogaNode;
                        rootYoga.Width = 1920f;
                        rootYoga.Height = 1080f;
                        yogaNode.Width = width;
                        yogaNode.Height = height;
                        yogaNode.MarginLeft = left;
                        yogaNode.MarginTop = top;
                        rootYoga.CalculateLayout();

                        // Apply layout via RectTransformSync
                        var sync = new RectTransformSync();
                        sync.ApplyLayout(dom.Root, treeManager);

                        // Verify RectTransform was set correctly
                        var rt = go.GetComponent<RectTransform>();
                        Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMin, "Anchors should be top-left");
                        Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMax, "Anchors should be top-left");
                        Assert.AreEqual(new Vector2(0f, 1f), rt.pivot, "Pivot should be top-left");

                        // anchoredPosition = (layoutX, -layoutY), sizeDelta = (layoutWidth, layoutHeight)
                        var expectedX = yogaNode.LayoutX;
                        var expectedY = yogaNode.LayoutY;
                        Assert.AreEqual(expectedX, rt.anchoredPosition.x, 0.01f,
                            $"anchoredPosition.x should match LayoutX ({expectedX})");
                        Assert.AreEqual(-expectedY, rt.anchoredPosition.y, 0.01f,
                            $"anchoredPosition.y should match -LayoutY ({-expectedY})");
                        Assert.AreEqual(yogaNode.LayoutWidth, rt.sizeDelta.x, 0.01f,
                            $"sizeDelta.x should match LayoutWidth ({yogaNode.LayoutWidth})");
                        Assert.AreEqual(yogaNode.LayoutHeight, rt.sizeDelta.y, 0.01f,
                            $"sizeDelta.y should match LayoutHeight ({yogaNode.LayoutHeight})");
                    }
                    finally
                    {
                        Object.DestroyImmediate(go);
                    }
                }).QuickCheckThrowOnFailure();
        }

        private static Gen<float> GenLayoutValue()
        {
            return Gen.Choose(0, 500).Select(i => (float)i);
        }

        private static Gen<float> GenPositiveDimension()
        {
            return Gen.Choose(1, 400).Select(i => (float)i);
        }
    }
}
