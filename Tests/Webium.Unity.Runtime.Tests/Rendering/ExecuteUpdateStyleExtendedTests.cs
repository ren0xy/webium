using System;
using System.Collections.Generic;
using System.Text;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Rendering
{
    /// <summary>
    /// Unit tests for ExecuteUpdateStyle extended CSS properties.
    /// Requirements: 4.1, 4.2, 4.3, 4.5
    /// </summary>
    [TestFixture]
    public class ExecuteUpdateStyleExtendedTests
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

        #region background-color (Req 4.1)

        [Test]
        public void BackgroundColor_Hex_SetsImageColor()
        {
            CreateNode(1, NodeTag.Div);
            ApplyStyles(1, "background-color=#FF0000");

            var image = _executor.NodeObjects[1].GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.IsTrue(image.enabled);
            Assert.AreEqual(1f, image.color.r, 0.01f);
            Assert.AreEqual(0f, image.color.g, 0.01f);
            Assert.AreEqual(0f, image.color.b, 0.01f);
        }

        [Test]
        public void BackgroundColor_Rgb_SetsImageColor()
        {
            CreateNode(1, NodeTag.Div);
            ApplyStyles(1, "background-color=rgb(0, 128, 255)");

            var image = _executor.NodeObjects[1].GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.IsTrue(image.enabled);
            Assert.AreEqual(0f, image.color.r, 0.01f);
            Assert.AreEqual(128f / 255f, image.color.g, 0.01f);
            Assert.AreEqual(1f, image.color.b, 0.01f);
        }

        [Test]
        public void BackgroundColor_NamedColor_SetsImageColor()
        {
            CreateNode(1, NodeTag.Div);
            ApplyStyles(1, "background-color=red");

            var image = _executor.NodeObjects[1].GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.IsTrue(image.enabled);
            Assert.AreEqual(Color.red, image.color);
        }

        [Test]
        public void BackgroundColor_Transparent_DisablesImage()
        {
            CreateNode(1, NodeTag.Div);
            ApplyStyles(1, "background-color=transparent");

            var image = _executor.NodeObjects[1].GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.IsFalse(image.enabled, "Image should be disabled for transparent");
        }

        [Test]
        public void BackgroundColor_NoImage_AddsImageComponent()
        {
            // Span nodes don't get an Image by default
            CreateNode(1, NodeTag.Span);
            Assert.IsNull(_executor.NodeObjects[1].GetComponent<Image>(), "Precondition: Span has no Image");

            ApplyStyles(1, "background-color=#00FF00");

            var image = _executor.NodeObjects[1].GetComponent<Image>();
            Assert.IsNotNull(image, "Image should be added when applying background-color");
            Assert.IsTrue(image.enabled);
            Assert.AreEqual(0f, image.color.r, 0.01f);
            Assert.AreEqual(1f, image.color.g, 0.01f);
            Assert.AreEqual(0f, image.color.b, 0.01f);
        }

        #endregion

        #region color (Req 4.2)

        [Test]
        public void Color_OnTextNode_SetsTMPColor()
        {
            CreateNode(1, NodeTag.Span);
            ApplyStyles(1, "color=blue");

            var tmp = _executor.NodeObjects[1].GetComponent<TextMeshProUGUI>();
            Assert.IsNotNull(tmp);
            Assert.AreEqual(Color.blue, tmp.color);
        }

        [Test]
        public void Color_OnNonTextWithWebiumTextChild_SetsChildTMPColor()
        {
            // Create a Div node (no TMP on root)
            CreateNode(1, NodeTag.Div);
            var go = _executor.NodeObjects[1];

            // Simulate __WebiumText child (created by ExecuteUpdateText for non-text nodes)
            var childGo = new GameObject("__WebiumText");
            childGo.transform.SetParent(go.transform, false);
            childGo.AddComponent<RectTransform>();
            var childTmp = childGo.AddComponent<TextMeshProUGUI>();

            ApplyStyles(1, "color=red");

            Assert.AreEqual(Color.red, childTmp.color);
        }

        #endregion

        #region font-size (Req 4.3)

        [Test]
        public void FontSize_PxValue_SetsTMPFontSize()
        {
            CreateNode(1, NodeTag.Span);
            ApplyStyles(1, "font-size=24px");

            var tmp = _executor.NodeObjects[1].GetComponent<TextMeshProUGUI>();
            Assert.IsNotNull(tmp);
            Assert.AreEqual(24f, tmp.fontSize, 0.01f);
        }

        [Test]
        public void FontSize_OnNonTextWithWebiumTextChild_SetsChildFontSize()
        {
            CreateNode(1, NodeTag.Div);
            var go = _executor.NodeObjects[1];

            var childGo = new GameObject("__WebiumText");
            childGo.transform.SetParent(go.transform, false);
            childGo.AddComponent<RectTransform>();
            var childTmp = childGo.AddComponent<TextMeshProUGUI>();

            ApplyStyles(1, "font-size=32px");

            Assert.AreEqual(32f, childTmp.fontSize, 0.01f);
        }

        #endregion

        #region Regression: CommonStyleApplier properties still work (Req 4.5)

        [Test]
        public void Display_None_DeactivatesGameObject()
        {
            CreateNode(1, NodeTag.Div);
            ApplyStyles(1, "display=none");

            Assert.IsFalse(_executor.NodeObjects[1].activeSelf);
        }

        [Test]
        public void Opacity_SetsAlphaOnGraphics()
        {
            CreateNode(1, NodeTag.Div);
            ApplyStyles(1, "opacity=0.5");

            var image = _executor.NodeObjects[1].GetComponent<Image>();
            Assert.IsNotNull(image);
            Assert.AreEqual(0.5f, image.color.a, 0.01f);
        }

        [Test]
        public void FontWeight_Bold_SetsBoldStyle()
        {
            CreateNode(1, NodeTag.Span);
            ApplyStyles(1, "font-weight=bold");

            var tmp = _executor.NodeObjects[1].GetComponent<TextMeshProUGUI>();
            Assert.IsNotNull(tmp);
            Assert.IsTrue((tmp.fontStyle & FontStyles.Bold) != 0);
        }

        #endregion

        #region Command Buffer Builders

        private void CreateNode(int nodeId, NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(nodeId, tag));
        }

        private void ApplyStyles(int nodeId, string stylesPayload)
        {
            _executor.Execute(BuildUpdateStyleCommand(nodeId, stylesPayload));
        }

        /// <summary>
        /// Builds a binary Create command buffer.
        /// Format: [uint32 count][byte op][int32 nodeId][byte mask][byte tag]
        /// </summary>
        private static byte[] BuildCreateCommand(int nodeId, NodeTag tag)
        {
            var bytes = new List<byte>();
            bytes.AddRange(BitConverter.GetBytes((uint)1));   // command count
            bytes.Add((byte)RenderOp.Create);                 // op
            bytes.AddRange(BitConverter.GetBytes(nodeId));     // nodeId
            bytes.Add(0x01);                                   // field mask: FIELD_TAG
            bytes.Add((byte)tag);                              // tag value
            return bytes.ToArray();
        }

        /// <summary>
        /// Builds a binary UpdateStyle command buffer.
        /// Format: [uint32 count][byte op][int32 nodeId][byte mask=0x10][ushort len][UTF8 styles]
        /// Styles payload: key=value pairs separated by \0 (e.g., "background-color=#FF0000\0color=red")
        /// </summary>
        private static byte[] BuildUpdateStyleCommand(int nodeId, string stylesPayload)
        {
            var stylesBytes = Encoding.UTF8.GetBytes(stylesPayload);
            var bytes = new List<byte>();
            bytes.AddRange(BitConverter.GetBytes((uint)1));           // command count
            bytes.Add((byte)RenderOp.UpdateStyle);                   // op
            bytes.AddRange(BitConverter.GetBytes(nodeId));            // nodeId
            bytes.Add(0x10);                                          // field mask: FIELD_STYLES
            bytes.AddRange(BitConverter.GetBytes((ushort)stylesBytes.Length)); // styles length
            bytes.AddRange(stylesBytes);                              // styles payload
            return bytes.ToArray();
        }

        #endregion
    }
}
