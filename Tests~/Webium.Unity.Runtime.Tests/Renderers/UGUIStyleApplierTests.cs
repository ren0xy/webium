using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for UGUIStyleApplier.
    /// Requirements: 3.1, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2
    /// </summary>
    [TestFixture]
    public class UGUIStyleApplierTests
    {
        private GameObject _go;

        [SetUp]
        public void SetUp()
        {
            _go = new GameObject("TestCommonStyle");
        }

        [TearDown]
        public void TearDown()
        {
            Object.DestroyImmediate(_go);
        }

        // ── display: none deactivates GameObject (Req 4.1) ──

        [Test]
        public void Apply_DisplayNone_DeactivatesGameObject()
        {
            var styles = new Dictionary<string, string> { { "display", "none" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.IsFalse(_go.activeSelf);
        }

        // ── display: flex activates GameObject (Req 4.2) ──

        [Test]
        public void Apply_DisplayFlex_ActivatesGameObject()
        {
            _go.SetActive(false);
            var styles = new Dictionary<string, string> { { "display", "flex" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.IsTrue(_go.activeSelf);
        }

        // ── visibility: hidden sets alpha 0 on Graphic components (Req 5.1) ──

        [Test]
        public void Apply_VisibilityHidden_SetsAlphaZeroOnGraphics()
        {
            var image = _go.AddComponent<Image>();
            image.color = Color.white;
            var styles = new Dictionary<string, string> { { "visibility", "hidden" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.AreEqual(0f, image.color.a, 0.001f);
            Assert.IsTrue(_go.activeSelf, "GameObject should remain active");
        }

        // ── opacity with valid float sets alpha (Req 3.1) ──

        [Test]
        public void Apply_OpacityValidFloat_SetsAlpha()
        {
            var image = _go.AddComponent<Image>();
            image.color = Color.white;
            var styles = new Dictionary<string, string> { { "opacity", "0.5" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.AreEqual(0.5f, image.color.a, 0.001f);
        }

        // ── opacity with invalid string is no-op (Req 3.1) ──

        [Test]
        public void Apply_OpacityInvalidString_IsNoOp()
        {
            var image = _go.AddComponent<Image>();
            image.color = Color.white;
            var styles = new Dictionary<string, string> { { "opacity", "banana" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.AreEqual(1f, image.color.a, 0.001f);
        }

        // ── font-weight: bold sets bold flag on TMP (Req 6.1) ──

        [Test]
        public void Apply_FontWeightBold_SetsBoldFlag()
        {
            var tmp = _go.AddComponent<TextMeshProUGUI>();
            tmp.fontStyle = FontStyles.Normal;
            var styles = new Dictionary<string, string> { { "font-weight", "bold" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.IsTrue((tmp.fontStyle & FontStyles.Bold) != 0);
        }

        // ── font-style: italic sets italic flag on TMP (Req 6.2) ──

        [Test]
        public void Apply_FontStyleItalic_SetsItalicFlag()
        {
            var tmp = _go.AddComponent<TextMeshProUGUI>();
            tmp.fontStyle = FontStyles.Normal;
            var styles = new Dictionary<string, string> { { "font-style", "italic" } };

            UGUIStyleApplier.Apply(_go, styles);

            Assert.IsTrue((tmp.fontStyle & FontStyles.Italic) != 0);
        }

        // ── font-weight on non-text element is no-op (Req 6.1) ──

        [Test]
        public void Apply_FontWeightOnNonTextElement_IsNoOp()
        {
            // No TextMeshProUGUI component added
            var styles = new Dictionary<string, string> { { "font-weight", "bold" } };

            // Should not throw and should not add any component
            UGUIStyleApplier.Apply(_go, styles);

            Assert.IsNull(_go.GetComponent<TextMeshProUGUI>());
        }
    }
}
