using System;
using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Layout
{
    /// <summary>
    /// Unit tests for ExecuteUpdateLayout anchoring and positioning.
    /// Requirements: 5.1, 5.2, 5.3
    /// </summary>
    [TestFixture]
    public class ExecuteUpdateLayoutTests
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

        [Test]
        public void UpdateLayout_SpecificValues_SetsAllRectTransformFields()
        {
            _executor.Execute(BuildCreateCommand(1, NodeTag.Div));
            _executor.Execute(BuildUpdateLayoutCommand(1, 30f, 20f, 200f, 150f));

            var rt = _executor.NodeObjects[1].GetComponent<RectTransform>();

            Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMin, "anchorMin should be top-left");
            Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMax, "anchorMax should be top-left");
            Assert.AreEqual(new Vector2(0f, 1f), rt.pivot, "pivot should be top-left");
            Assert.AreEqual(new Vector2(30f, -20f), rt.anchoredPosition, "anchoredPosition should be (x, -y)");
            Assert.AreEqual(new Vector2(200f, 150f), rt.sizeDelta, "sizeDelta should be (width, height)");
        }

        [Test]
        public void UpdateLayout_ZeroValues_SetsOriginWithZeroSize()
        {
            _executor.Execute(BuildCreateCommand(1, NodeTag.Div));
            _executor.Execute(BuildUpdateLayoutCommand(1, 0f, 0f, 0f, 0f));

            var rt = _executor.NodeObjects[1].GetComponent<RectTransform>();

            Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMin);
            Assert.AreEqual(new Vector2(0f, 1f), rt.anchorMax);
            Assert.AreEqual(new Vector2(0f, 1f), rt.pivot);
            Assert.AreEqual(new Vector2(0f, 0f), rt.anchoredPosition);
            Assert.AreEqual(new Vector2(0f, 0f), rt.sizeDelta);
        }

        [Test]
        public void UpdateLayout_NonexistentNodeId_DoesNotThrow()
        {
            Assert.DoesNotThrow(() =>
                _executor.Execute(BuildUpdateLayoutCommand(999, 10f, 10f, 100f, 100f)));
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
