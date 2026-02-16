using System;
using System.Collections.Generic;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for text rendering on non-text elements via UnityRenderCommandExecutor.
    /// Requirements: 8.1, 8.2
    /// </summary>
    [TestFixture]
    public class TextOnNonTextElementTests
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
            UnityEngine.Object.DestroyImmediate(_rootGo);
        }

        [Test]
        public void UpdateText_HeadingElement_UpdatesTMP()
        {
            // Create an H1 node via the executor
            _executor.Execute(BuildCreateCommand(1, NodeTag.H1));

            // The executor creates a bare GO — HeadingRenderer isn't called via Execute.
            // Manually add TMP to simulate what HeadingRenderer.Sync would do.
            var go = _executor.NodeObjects[1];
            var tmp = go.AddComponent<TextMeshProUGUI>();

            // Now send UpdateText
            _executor.Execute(BuildUpdateTextCommand(1, "Hello"));

            Assert.AreEqual("Hello", tmp.text);
        }

        [Test]
        public void UpdateText_DivWithNoChildren_CreatesChildText()
        {
            // Create a Div node
            _executor.Execute(BuildCreateCommand(1, NodeTag.Div));

            // Send UpdateText on the Div
            _executor.Execute(BuildUpdateTextCommand(1, "Hello"));

            var go = _executor.NodeObjects[1];
            var childText = go.transform.Find("__WebiumText");
            Assert.IsNotNull(childText, "Expected __WebiumText child to be created");

            var tmp = childText.GetComponent<TextMeshProUGUI>();
            Assert.IsNotNull(tmp, "Expected TextMeshProUGUI on __WebiumText child");
            Assert.AreEqual("Hello", tmp.text);
        }

        [Test]
        public void UpdateText_DivWithChildren_IgnoresText()
        {
            // Create a Div (nodeId=1) and a Span child (nodeId=2, parentId=1)
            _executor.Execute(BuildCreateCommand(1, NodeTag.Div));
            _executor.Execute(BuildCreateCommandWithParent(2, NodeTag.Span, 1));

            // Send UpdateText on the Div that has children
            _executor.Execute(BuildUpdateTextCommand(1, "Hello"));

            var go = _executor.NodeObjects[1];
            var childText = go.transform.Find("__WebiumText");
            Assert.IsNull(childText, "Expected no __WebiumText child when Div has children");
        }

        #region Command Buffer Builders

        private static byte[] BuildCreateCommand(int nodeId, NodeTag tag)
        {
            var bytes = new List<byte>();
            // Command count: 1
            bytes.AddRange(BitConverter.GetBytes((uint)1));
            // Op: Create (0)
            bytes.Add((byte)RenderOp.Create);
            // NodeId
            bytes.AddRange(BitConverter.GetBytes(nodeId));
            // Mask: FIELD_TAG (bit 0)
            bytes.Add(1);
            // Tag value
            bytes.Add((byte)tag);
            return bytes.ToArray();
        }

        private static byte[] BuildCreateCommandWithParent(int nodeId, NodeTag tag, int parentId)
        {
            var bytes = new List<byte>();
            // Command count: 1
            bytes.AddRange(BitConverter.GetBytes((uint)1));
            // Op: Create (0)
            bytes.Add((byte)RenderOp.Create);
            // NodeId
            bytes.AddRange(BitConverter.GetBytes(nodeId));
            // Mask: FIELD_TAG | FIELD_PARENT_ID (bits 0 + 1)
            bytes.Add(1 | 2);
            // Tag value
            bytes.Add((byte)tag);
            // ParentId
            bytes.AddRange(BitConverter.GetBytes(parentId));
            return bytes.ToArray();
        }

        private static byte[] BuildUpdateTextCommand(int nodeId, string text)
        {
            var bytes = new List<byte>();
            // Command count: 1
            bytes.AddRange(BitConverter.GetBytes((uint)1));
            // Op: UpdateText (4)
            bytes.Add((byte)RenderOp.UpdateText);
            // NodeId
            bytes.AddRange(BitConverter.GetBytes(nodeId));
            // Mask: FIELD_TEXT (bit 5 = 32)
            bytes.Add(32);
            // Text: length (ushort) + UTF8 bytes
            var textBytes = System.Text.Encoding.UTF8.GetBytes(text);
            bytes.AddRange(BitConverter.GetBytes((ushort)textBytes.Length));
            bytes.AddRange(textBytes);
            return bytes.ToArray();
        }

        #endregion
    }
}
