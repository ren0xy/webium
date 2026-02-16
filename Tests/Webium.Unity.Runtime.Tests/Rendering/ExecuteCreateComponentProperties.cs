using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck;
using NUnit.Framework;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Rendering
{
    /// <summary>
    /// Property-based tests for ExecuteCreate visual component assignment.
    /// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
    /// </summary>
    [TestFixture]
    public class ExecuteCreateComponentProperties
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
        /// Property 1: ExecuteCreate assigns correct component set for each NodeTag.
        /// For any visual NodeTag, the created GameObject has exactly the expected
        /// component types from the design's component mapping table.
        /// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
        /// </summary>
        [Test]
        public void Property1_ExecuteCreate_AssignsCorrectComponentSet()
        {
            var config = Configuration.QuickThrowOnFailure;
            config.MaxNbOfTest = 100;

            // All visual NodeTags that should produce specific components
            var visualTags = new[]
            {
                NodeTag.Div, NodeTag.Body, NodeTag.Ul, NodeTag.Ol, NodeTag.Li,
                NodeTag.Span, NodeTag.P, NodeTag.Text,
                NodeTag.H1, NodeTag.H2, NodeTag.H3, NodeTag.H4, NodeTag.H5, NodeTag.H6,
                NodeTag.Button, NodeTag.A,
                NodeTag.Input,
                NodeTag.Img
            };

            var genTag = Gen.Elements(visualTags);

            Prop.ForAll(
                genTag.ToArbitrary(),
                tag =>
                {
                    // Reset executor for each iteration
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    _executor.Execute(BuildCreateCommand(1, tag));
                    var go = _executor.NodeObjects[1];

                    var hasImage = go.GetComponent<Image>() != null;
                    var hasTMP = go.GetComponent<TextMeshProUGUI>() != null;
                    var hasButton = go.GetComponent<UnityEngine.UI.Button>() != null;
                    var hasRawImage = go.GetComponent<RawImage>() != null;
                    var hasInputField = go.GetComponent<TMP_InputField>() != null;

                    var expected = GetExpectedComponents(tag);

                    return (hasImage == expected.image
                         && hasTMP == expected.tmp
                         && hasButton == expected.button
                         && hasRawImage == expected.rawImage
                         && hasInputField == expected.inputField)
                        .Label($"Tag={tag}: Image={hasImage}(exp={expected.image}) " +
                               $"TMP={hasTMP}(exp={expected.tmp}) " +
                               $"Button={hasButton}(exp={expected.button}) " +
                               $"RawImage={hasRawImage}(exp={expected.rawImage}) " +
                               $"InputField={hasInputField}(exp={expected.inputField})");
                }).Check(config);
        }

        /// <summary>
        /// Property 2: Heading font sizes match DefaultSizes table.
        /// For any heading tag (H1–H6), the TextMeshProUGUI.fontSize equals
        /// HeadingRenderer.DefaultSizes[tag] and fontStyle includes Bold.
        /// **Validates: Requirements 3.4**
        /// </summary>
        [Test]
        public void Property2_HeadingFontSizes_MatchDefaultSizesTable()
        {
            var config = Configuration.QuickThrowOnFailure;
            config.MaxNbOfTest = 100;

            var headingTags = new[] { NodeTag.H1, NodeTag.H2, NodeTag.H3, NodeTag.H4, NodeTag.H5, NodeTag.H6 };
            var genTag = Gen.Elements(headingTags);

            Prop.ForAll(
                genTag.ToArbitrary(),
                tag =>
                {
                    // Reset executor for each iteration
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    _executor.Execute(BuildCreateCommand(1, tag));
                    var go = _executor.NodeObjects[1];

                    var tmp = go.GetComponent<TextMeshProUGUI>();
                    if (tmp == null)
                        return false.Label($"Tag={tag}: TMP component missing");

                    var expectedSize = HeadingRenderer.DefaultSizes[tag];
                    var sizeMatch = Mathf.Abs(tmp.fontSize - expectedSize) < 0.01f;
                    var isBold = (tmp.fontStyle & FontStyles.Bold) != 0;

                    return (sizeMatch && isBold)
                        .Label($"Tag={tag}: fontSize={tmp.fontSize}(exp={expectedSize}) bold={isBold}");
                }).Check(config);
        }

        #region Helpers

        private static (bool image, bool tmp, bool button, bool rawImage, bool inputField) GetExpectedComponents(NodeTag tag)
        {
            switch (tag)
            {
                // Container tags: Image only
                case NodeTag.Div:
                case NodeTag.Body:
                case NodeTag.Ul:
                case NodeTag.Ol:
                case NodeTag.Li:
                    return (image: true, tmp: false, button: false, rawImage: false, inputField: false);

                // Text tags: TMP only
                case NodeTag.Span:
                case NodeTag.P:
                case NodeTag.Text:
                    return (image: false, tmp: true, button: false, rawImage: false, inputField: false);

                // Heading tags: TMP only (with bold + size)
                case NodeTag.H1: case NodeTag.H2: case NodeTag.H3:
                case NodeTag.H4: case NodeTag.H5: case NodeTag.H6:
                    return (image: false, tmp: true, button: false, rawImage: false, inputField: false);

                // Button/A tags: Image + Button
                case NodeTag.Button:
                case NodeTag.A:
                    return (image: true, tmp: false, button: true, rawImage: false, inputField: false);

                // Input: Image + InputField (TMP is on children, not root)
                case NodeTag.Input:
                    return (image: true, tmp: false, button: false, rawImage: false, inputField: true);

                // Img: RawImage only
                case NodeTag.Img:
                    return (image: false, tmp: false, button: false, rawImage: true, inputField: false);

                default:
                    return (image: false, tmp: false, button: false, rawImage: false, inputField: false);
            }
        }

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
