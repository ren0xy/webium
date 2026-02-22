using System;
using System.Collections.Generic;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Rendering
{
    /// <summary>
    /// Unit tests for ExecuteCreate visual component assignment.
    /// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
    /// </summary>
    [TestFixture]
    public class ExecuteCreateComponentTests
    {
        private GameObject _rootGo;
        private UGUIRenderCommandExecutor _executor;

        [SetUp]
        public void SetUp()
        {
            _rootGo = new GameObject("TestRoot");
            _rootGo.AddComponent<RectTransform>();
            _executor = new UGUIRenderCommandExecutor(_rootGo.transform);
        }

        [TearDown]
        public void TearDown()
        {
            foreach (var kvp in _executor.NodeObjects)
                UnityEngine.Object.DestroyImmediate(kvp.Value);
            UnityEngine.Object.DestroyImmediate(_rootGo);
        }

        #region Container tags — Div, Body, Ul, Ol, Li (Req 3.2)

        [TestCase(NodeTag.Div)]
        [TestCase(NodeTag.Body)]
        [TestCase(NodeTag.Ul)]
        [TestCase(NodeTag.Ol)]
        [TestCase(NodeTag.Li)]
        public void Create_ContainerTag_AddsTransparentImage(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            var image = go.GetComponent<Image>();
            Assert.IsNotNull(image, $"{tag} should have Image component");
            Assert.AreEqual(new Color(0, 0, 0, 0), image.color, "Image should be transparent");
            Assert.IsTrue(image.raycastTarget, "Image raycastTarget should be enabled");
        }

        [TestCase(NodeTag.Div)]
        [TestCase(NodeTag.Body)]
        [TestCase(NodeTag.Ul)]
        [TestCase(NodeTag.Ol)]
        [TestCase(NodeTag.Li)]
        public void Create_ContainerTag_NoTextComponent(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            Assert.IsNull(go.GetComponent<TextMeshProUGUI>(), $"{tag} should not have TMP");
        }

        #endregion

        #region Text tags — Span, P, Text (Req 3.3)

        [TestCase(NodeTag.Span)]
        [TestCase(NodeTag.P)]
        [TestCase(NodeTag.Text)]
        public void Create_TextTag_AddsTextMeshProUGUI(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            Assert.IsNotNull(go.GetComponent<TextMeshProUGUI>(), $"{tag} should have TMP");
        }

        [TestCase(NodeTag.Span)]
        [TestCase(NodeTag.P)]
        [TestCase(NodeTag.Text)]
        public void Create_TextTag_NoImageComponent(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            Assert.IsNull(go.GetComponent<Image>(), $"{tag} should not have Image");
        }

        #endregion

        #region Heading tags — H1–H6 (Req 3.4)

        [TestCase(NodeTag.H1, 32f)]
        [TestCase(NodeTag.H2, 24f)]
        [TestCase(NodeTag.H3, 18.72f)]
        [TestCase(NodeTag.H4, 16f)]
        [TestCase(NodeTag.H5, 13.28f)]
        [TestCase(NodeTag.H6, 10.72f)]
        public void Create_HeadingTag_AddsTMPWithCorrectSize(NodeTag tag, float expectedSize)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            var tmp = go.GetComponent<TextMeshProUGUI>();
            Assert.IsNotNull(tmp, $"{tag} should have TMP");
            Assert.AreEqual(expectedSize, tmp.fontSize, 0.01f, $"{tag} fontSize");
        }

        [TestCase(NodeTag.H1)]
        [TestCase(NodeTag.H2)]
        [TestCase(NodeTag.H3)]
        [TestCase(NodeTag.H4)]
        [TestCase(NodeTag.H5)]
        [TestCase(NodeTag.H6)]
        public void Create_HeadingTag_HasBoldStyle(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            var tmp = go.GetComponent<TextMeshProUGUI>();
            Assert.IsNotNull(tmp);
            Assert.IsTrue((tmp.fontStyle & FontStyles.Bold) != 0, $"{tag} should be bold");
        }

        #endregion

        #region Button/A tags (Req 3.5)

        [TestCase(NodeTag.Button)]
        [TestCase(NodeTag.A)]
        public void Create_ButtonTag_AddsImageAndButton(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            Assert.IsNotNull(go.GetComponent<Image>(), $"{tag} should have Image");
            var button = go.GetComponent<UnityEngine.UI.Button>();
            Assert.IsNotNull(button, $"{tag} should have Button");
            Assert.AreEqual(Selectable.Transition.None, button.transition, "Button transition should be None");
        }

        #endregion

        #region Input tag (Req 3.6)

        [Test]
        public void Create_Input_AddsImageAndInputField()
        {
            _executor.Execute(BuildCreateCommand(1, NodeTag.Input));
            var go = _executor.NodeObjects[1];

            Assert.IsNotNull(go.GetComponent<Image>(), "Input should have Image");
            Assert.IsNotNull(go.GetComponent<TMP_InputField>(), "Input should have TMP_InputField");
        }

        [Test]
        public void Create_Input_HasTextAreaWithTextAndPlaceholder()
        {
            _executor.Execute(BuildCreateCommand(1, NodeTag.Input));
            var go = _executor.NodeObjects[1];

            var textArea = go.transform.Find("Text Area");
            Assert.IsNotNull(textArea, "Input should have Text Area child");

            var text = textArea.Find("Text");
            Assert.IsNotNull(text, "Text Area should have Text child");
            Assert.IsNotNull(text.GetComponent<TextMeshProUGUI>(), "Text child should have TMP");

            var placeholder = textArea.Find("Placeholder");
            Assert.IsNotNull(placeholder, "Text Area should have Placeholder child");
            Assert.IsNotNull(placeholder.GetComponent<TextMeshProUGUI>(), "Placeholder should have TMP");
        }

        #endregion

        #region Img tag (Req 3.7)

        [Test]
        public void Create_Img_AddsRawImage()
        {
            _executor.Execute(BuildCreateCommand(1, NodeTag.Img));
            var go = _executor.NodeObjects[1];

            Assert.IsNotNull(go.GetComponent<RawImage>(), "Img should have RawImage");
        }

        #endregion

        #region Unknown tag (Req 3.8)

        [Test]
        public void Create_Unknown_BareRectTransform()
        {
            _executor.Execute(BuildCreateCommand(1, NodeTag.Unknown));
            var go = _executor.NodeObjects[1];

            Assert.IsNotNull(go.GetComponent<RectTransform>(), "Should have RectTransform");
            Assert.IsNull(go.GetComponent<Image>(), "Should not have Image");
            Assert.IsNull(go.GetComponent<TextMeshProUGUI>(), "Should not have TMP");
            Assert.IsNull(go.GetComponent<RawImage>(), "Should not have RawImage");
        }

        #endregion

        #region Non-visual tags (Req 3.1 — no visual components)

        [TestCase(NodeTag.Style)]
        [TestCase(NodeTag.Script)]
        [TestCase(NodeTag.Link)]
        [TestCase(NodeTag.Head)]
        [TestCase(NodeTag.Html)]
        public void Create_NonVisualTag_NoVisualComponents(NodeTag tag)
        {
            _executor.Execute(BuildCreateCommand(1, tag));
            var go = _executor.NodeObjects[1];

            Assert.IsNotNull(go.GetComponent<RectTransform>(), $"{tag} should have RectTransform");
            Assert.IsNull(go.GetComponent<Image>(), $"{tag} should not have Image");
            Assert.IsNull(go.GetComponent<TextMeshProUGUI>(), $"{tag} should not have TMP");
            Assert.IsNull(go.GetComponent<RawImage>(), $"{tag} should not have RawImage");
            Assert.IsNull(go.GetComponent<UnityEngine.UI.Button>(), $"{tag} should not have Button");
        }

        #endregion

        #region Command Buffer Builder

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

        #endregion
    }
}
