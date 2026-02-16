using System;
using System.Collections.Generic;
using FsCheck;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Layout
{
    /// <summary>
    /// Property-based tests for ExecuteUpdateLayout anchoring, tag-agnosticism, and readback round-trip.
    /// Validates: Requirements 3.1, 3.2, 6.1, 8.1
    /// </summary>
    [TestFixture]
    public class ExecuteUpdateLayoutProperties
    {
        private GameObject _rootGo;
        private UnityRenderCommandExecutor _executor;

        [SetUp]
        public void SetUp()
        {
            _rootGo = new GameObject("TestRoot");
            _rootGo.AddComponent<RectTransform>();
            _executor = new UnityRenderCommandExecutor(_rootGo.transform);
        }

        [TearDown]
        public void TearDown()
        {
            foreach (var kvp in _executor.NodeObjects)
                UnityEngine.Object.DestroyImmediate(kvp.Value);
            UnityEngine.Object.DestroyImmediate(_rootGo);
        }

        /// <summary>
        /// Property 1: ExecuteUpdateLayout sets correct RectTransform values.
        /// For any non-negative (x, y) and positive (w, h), the target RectTransform
        /// SHALL have anchorMin=(0,1), anchorMax=(0,1), pivot=(0,1),
        /// anchoredPosition=(x,-y), sizeDelta=(w,h).
        /// **Validates: Requirements 3.1, 3.2**
        /// </summary>
        [Test]
        public void Property1_ExecuteUpdateLayout_SetsCorrectRectTransformValues()
        {
            var genPos = Gen.Choose(0, 500).Select(i => (float)i);
            var genDim = Gen.Choose(1, 400).Select(i => (float)i);

            Prop.ForAll(
                genPos.ToArbitrary(),
                genPos.ToArbitrary(),
                genDim.ToArbitrary(),
                genDim.ToArbitrary(),
                (x, y, w, h) =>
                {
                    // Reset executor for each iteration
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    _executor.Execute(BuildCreateCommand(1, NodeTag.Div));
                    _executor.Execute(BuildUpdateLayoutCommand(1, x, y, w, h));

                    var rt = _executor.NodeObjects[1].GetComponent<RectTransform>();

                    Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMin, "anchorMin");
                    Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMax, "anchorMax");
                    Assert.AreEqual(new Vector2(0f, 1f), rt.pivot, "pivot");
                    Assert.AreEqual(new Vector2(x, -y), rt.anchoredPosition, "anchoredPosition");
                    Assert.AreEqual(new Vector2(w, h), rt.sizeDelta, "sizeDelta");

                    return true;
                }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 2: Layout application is tag-agnostic.
        /// For any NodeTag and layout values, the resulting anchoredPosition and sizeDelta
        /// SHALL be identical regardless of which NodeTag was used during creation.
        /// **Validates: Requirements 6.1**
        /// </summary>
        [Test]
        public void Property2_LayoutApplication_IsTagAgnostic()
        {
            var genTag = Gen.Elements((NodeTag[])System.Enum.GetValues(typeof(NodeTag)));
            var genPos = Gen.Choose(0, 500).Select(i => (float)i);
            var genDim = Gen.Choose(1, 400).Select(i => (float)i);

            Prop.ForAll(
                genTag.ToArbitrary(),
                genPos.ToArbitrary(),
                genPos.ToArbitrary(),
                genDim.ToArbitrary(),
                genDim.ToArbitrary(),
                (tag, x, y, w, h) =>
                {
                    // Reset executor
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    _executor.Execute(BuildCreateCommand(1, tag));
                    _executor.Execute(BuildUpdateLayoutCommand(1, x, y, w, h));

                    var rt = _executor.NodeObjects[1].GetComponent<RectTransform>();

                    // Compare against expected values (same regardless of tag)
                    Assert.AreEqual(new Vector2(x, -y), rt.anchoredPosition,
                        $"anchoredPosition should be ({x}, {-y}) for tag {tag}");
                    Assert.AreEqual(new Vector2(w, h), rt.sizeDelta,
                        $"sizeDelta should be ({w}, {h}) for tag {tag}");

                    return true;
                }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 3: Layout write-read round trip.
        /// For any layout values, when ExecuteUpdateLayout writes them and
        /// UnityLayoutBridge reads them back, the readback values SHALL match.
        /// **Validates: Requirements 8.1**
        /// </summary>
        [Test]
        public void Property3_LayoutWriteReadRoundTrip()
        {
            var genPos = Gen.Choose(0, 500).Select(i => (float)i);
            var genDim = Gen.Choose(1, 400).Select(i => (float)i);

            Prop.ForAll(
                genPos.ToArbitrary(),
                genPos.ToArbitrary(),
                genDim.ToArbitrary(),
                genDim.ToArbitrary(),
                (x, y, w, h) =>
                {
                    // Reset executor
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    _executor.Execute(BuildCreateCommand(1, NodeTag.Div));
                    _executor.Execute(BuildUpdateLayoutCommand(1, x, y, w, h));

                    // Build dictionary for UnityLayoutBridge from executor's NodeObjects
                    var dict = new Dictionary<int, GameObject>();
                    foreach (var kvp in _executor.NodeObjects)
                        dict[kvp.Key] = kvp.Value;

                    // Create a dummy canvas RectTransform for the bridge
                    var canvasGo = new GameObject("PBT_Canvas");
                    try
                    {
                        var canvasRect = canvasGo.AddComponent<RectTransform>();
                        var bridge = new UnityLayoutBridge(canvasRect, dict);

                        Assert.AreEqual(x, bridge.GetX(1), 0.001f, "GetX round-trip");
                        Assert.AreEqual(y, bridge.GetY(1), 0.001f, "GetY round-trip");
                        Assert.AreEqual(w, bridge.GetWidth(1), 0.001f, "GetWidth round-trip");
                        Assert.AreEqual(h, bridge.GetHeight(1), 0.001f, "GetHeight round-trip");

                        return true;
                    }
                    finally
                    {
                        UnityEngine.Object.DestroyImmediate(canvasGo);
                    }
                }).QuickCheckThrowOnFailure();
        }

        #region Command Buffer Builders

        private static byte[] BuildCreateCommand(int nodeId, NodeTag tag)
        {
            var bytes = new List<byte>();
            bytes.AddRange(BitConverter.GetBytes((uint)1));
            bytes.Add((byte)RenderOp.Create);
            bytes.AddRange(BitConverter.GetBytes(nodeId));
            bytes.Add(0x01); // FIELD_TAG
            bytes.Add((byte)tag);
            return bytes.ToArray();
        }

        private static byte[] BuildUpdateLayoutCommand(int nodeId, float x, float y, float w, float h)
        {
            var bytes = new List<byte>();
            bytes.AddRange(BitConverter.GetBytes((uint)1));
            bytes.Add((byte)RenderOp.UpdateLayout);
            bytes.AddRange(BitConverter.GetBytes(nodeId));
            bytes.Add(0x08); // FIELD_LAYOUT
            bytes.AddRange(BitConverter.GetBytes(x));
            bytes.AddRange(BitConverter.GetBytes(y));
            bytes.AddRange(BitConverter.GetBytes(w));
            bytes.AddRange(BitConverter.GetBytes(h));
            return bytes.ToArray();
        }

        #endregion
    }
}
