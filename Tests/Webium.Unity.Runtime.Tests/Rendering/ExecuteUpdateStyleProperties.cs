using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
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
    /// Property-based tests for ExecuteUpdateStyle extended CSS properties.
    /// Uses FsCheck with minimum 100 iterations per property.
    /// </summary>
    [TestFixture]
    public class ExecuteUpdateStyleProperties
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
        /// Property 3: background-color application is idempotent.
        /// For any valid CSS color string, applying background-color twice
        /// produces the same Image.color as applying it once.
        /// **Validates: Requirements 4.1**
        /// </summary>
        [Test]
        public void Property3_BackgroundColor_ApplicationIsIdempotent()
        {
            var config = Configuration.QuickThrowOnFailure;
            config.MaxNbOfTest = 100;

            // Generate valid CSS color strings that CSSColorParser can parse
            var genColor = Gen.OneOf(
                // Hex colors: #RRGGBB
                from r in Gen.Choose(0, 255)
                from g in Gen.Choose(0, 255)
                from b in Gen.Choose(0, 255)
                select $"#{r:X2}{g:X2}{b:X2}",
                // rgb() colors
                from r in Gen.Choose(0, 255)
                from g in Gen.Choose(0, 255)
                from b in Gen.Choose(0, 255)
                select $"rgb({r}, {g}, {b})",
                // Named colors
                Gen.Elements("white", "black", "red", "green", "blue",
                             "yellow", "cyan", "magenta", "gray", "transparent")
            );

            Prop.ForAll(
                genColor.ToArbitrary(),
                colorStr =>
                {
                    // Reset executor
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    // Create a Div node (has Image by default)
                    _executor.Execute(BuildCreateCommand(1, NodeTag.Div));

                    // Apply background-color once
                    _executor.Execute(BuildUpdateStyleCommand(1, $"background-color={colorStr}"));
                    var go = _executor.NodeObjects[1];
                    var image = go.GetComponent<Image>();
                    var colorAfterFirst = image.color;
                    var enabledAfterFirst = image.enabled;

                    // Apply background-color again (same value)
                    _executor.Execute(BuildUpdateStyleCommand(1, $"background-color={colorStr}"));
                    var colorAfterSecond = image.color;
                    var enabledAfterSecond = image.enabled;

                    return (colorAfterFirst == colorAfterSecond && enabledAfterFirst == enabledAfterSecond)
                        .Label($"color='{colorStr}': " +
                               $"first={colorAfterFirst}(enabled={enabledAfterFirst}) " +
                               $"second={colorAfterSecond}(enabled={enabledAfterSecond})");
                }).Check(config);
        }

        /// <summary>
        /// Property 4: font-size application matches CSSUnitParser output.
        /// For any positive pixel value, applying font-size to a text node
        /// sets TMP.fontSize to exactly CSSUnitParser.ParsePx(value).
        /// **Validates: Requirements 4.3**
        /// </summary>
        [Test]
        public void Property4_FontSize_MatchesCSSUnitParserOutput()
        {
            var config = Configuration.QuickThrowOnFailure;
            config.MaxNbOfTest = 100;

            // Generate positive pixel values (1–200 range, with decimal precision)
            var genPxValue = Gen.OneOf(
                // Integer px values
                from px in Gen.Choose(1, 200)
                select $"{px}px",
                // Decimal px values
                from whole in Gen.Choose(1, 200)
                from frac in Gen.Choose(0, 99)
                select $"{whole}.{frac}px"
            );

            Prop.ForAll(
                genPxValue.ToArbitrary(),
                pxStr =>
                {
                    // Reset executor
                    foreach (var kvp in _executor.NodeObjects)
                        UnityEngine.Object.DestroyImmediate(kvp.Value);
                    _executor = new UnityRenderCommandExecutor(_rootGo.transform);

                    // Create a Span node (has TMP by default)
                    _executor.Execute(BuildCreateCommand(1, NodeTag.Span));

                    // Apply font-size
                    _executor.Execute(BuildUpdateStyleCommand(1, $"font-size={pxStr}"));

                    var tmp = _executor.NodeObjects[1].GetComponent<TextMeshProUGUI>();
                    var expectedSize = CSSUnitParser.ParsePx(pxStr);
                    var actualSize = tmp.fontSize;

                    return (Mathf.Abs(actualSize - expectedSize) < 0.001f)
                        .Label($"px='{pxStr}': expected={expectedSize} actual={actualSize}");
                }).Check(config);
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

        private static byte[] BuildUpdateStyleCommand(int nodeId, string stylesPayload)
        {
            var stylesBytes = Encoding.UTF8.GetBytes(stylesPayload);
            var bytes = new List<byte>();
            bytes.AddRange(BitConverter.GetBytes((uint)1));
            bytes.Add((byte)RenderOp.UpdateStyle);
            bytes.AddRange(BitConverter.GetBytes(nodeId));
            bytes.Add(0x10); // FIELD_STYLES
            bytes.AddRange(BitConverter.GetBytes((ushort)stylesBytes.Length));
            bytes.AddRange(stylesBytes);
            return bytes.ToArray();
        }

        #endregion
    }
}
