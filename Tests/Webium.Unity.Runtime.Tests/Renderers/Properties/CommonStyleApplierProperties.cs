using System.Collections.Generic;
using System.Globalization;
using FsCheck;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers.Properties
{
    /// <summary>
    /// Property-based tests for CommonStyleApplier.
    /// Validates: Requirements 3.1, 4.1, 4.2
    /// </summary>
    [TestFixture]
    public class CommonStyleApplierProperties
    {
        /// <summary>
        /// Property 3: Opacity modulates alpha on all Graphic components.
        /// For any opacity value v in [0, 1], every Graphic component on the
        /// GameObject should have color.a == v after applying the style.
        /// **Validates: Requirements 3.1**
        /// </summary>
        [Test]
        public void Property3_OpacityModulatesAlphaOnAllGraphics()
        {
            // Generate integer in [0, 100] then divide by 100 to get a float
            // in [0, 1] without floating-point generation issues.
            var genOpacity = Gen.Choose(0, 100).Select(i => i / 100f);

            Prop.ForAll(
                genOpacity.ToArbitrary(),
                opacity =>
                {
                    var go = new GameObject("PBT_Opacity");
                    try
                    {
                        // Add two Image components (Graphic subclass) to verify ALL are modulated
                        var image1 = go.AddComponent<Image>();
                        image1.color = Color.white;
                        var image2 = go.AddComponent<Image>();
                        image2.color = Color.white;

                        var styles = new Dictionary<string, string>
                        {
                            { "opacity", opacity.ToString(CultureInfo.InvariantCulture) }
                        };

                        CommonStyleApplier.Apply(go, styles);

                        var graphics = go.GetComponents<Graphic>();
                        foreach (var graphic in graphics)
                        {
                            Assert.AreEqual(opacity, graphic.color.a, 0.01f,
                                $"Graphic alpha should equal opacity {opacity}");
                        }

                        return true.Label($"opacity={opacity} applied to {graphics.Length} graphics");
                    }
                    finally
                    {
                        Object.DestroyImmediate(go);
                    }
                }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 4: Display none deactivates, any other value activates.
        /// For any string s, applying display: s via CommonStyleApplier should set
        /// GameObject.activeSelf to false iff s (trimmed, lowercased) equals "none",
        /// and true otherwise.
        /// **Validates: Requirements 4.1, 4.2**
        /// </summary>
        [Test]
        public void Property4_DisplayNoneDeactivatesAnyOtherActivates()
        {
            var genDisplayValue = Gen.OneOf(
                Gen.Elements("none", "None", "NONE", " none ", "flex", "block", "inline", "grid", ""),
                Gen.Resize(20, Arb.Generate<NonNull<string>>().Select(s => s.Get))
            );

            Prop.ForAll(
                genDisplayValue.ToArbitrary(),
                displayValue =>
                {
                    var go = new GameObject("PBT_Display");
                    try
                    {
                        var styles = new Dictionary<string, string>
                        {
                            { "display", displayValue }
                        };

                        CommonStyleApplier.Apply(go, styles);

                        bool expectedActive = displayValue.Trim().ToLowerInvariant() != "none";
                        bool actualActive = go.activeSelf;

                        Assert.AreEqual(expectedActive, actualActive,
                            $"display=\"{displayValue}\" → expected activeSelf={expectedActive}, got {actualActive}");

                        return expectedActive == actualActive;
                    }
                    finally
                    {
                        Object.DestroyImmediate(go);
                    }
                }).QuickCheckThrowOnFailure();
        }
    }
}
