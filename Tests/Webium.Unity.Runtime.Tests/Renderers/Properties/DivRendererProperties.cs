using FsCheck;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers.Properties
{
    /// <summary>
    /// Property-based tests for DivRenderer.
    /// Validates: Requirements 2.1, 2.2, 7.1
    /// </summary>
    [TestFixture]
    public class DivRendererProperties
    {
        private static Gen<byte> GenByte => Gen.Choose(0, 255).Select(i => (byte)i);

        private static Gen<(byte r, byte g, byte b)> GenRGB =>
            from r in GenByte
            from g in GenByte
            from b in GenByte
            select (r, g, b);

        /// <summary>
        /// Property 3: DivRenderer ensures Image component exists.
        /// For any VirtualNode with Tag == Div and a valid RenderHandle,
        /// after Sync the backing GameObject has exactly one Image component.
        /// **Validates: Requirements 2.1, 7.1**
        /// </summary>
        [Test]
        public void Property3_EnsuresImageComponentExists()
        {
            var renderer = new DivRenderer();

            Prop.ForAll(GenRGB.ToArbitrary(), rgb =>
            {
                var dom = new VirtualDOM();
                var node = dom.CreateElement(NodeTag.Div);
                node.MarkDirty(DirtyFlags.Style);
                node.InlineStyles["background-color"] =
                    $"#{rgb.r:X2}{rgb.g:X2}{rgb.b:X2}";

                var go = new GameObject("PBT_Div");
                node.RenderHandle = go;

                try
                {
                    renderer.Sync(node);

                    var images = go.GetComponents<Image>();
                    return (images.Length == 1)
                        .Label($"Expected 1 Image, got {images.Length}");
                }
                finally
                {
                    Object.DestroyImmediate(go);
                }
            }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 3 (idempotent): Calling Sync twice still yields exactly one Image.
        /// **Validates: Requirements 7.1**
        /// </summary>
        [Test]
        public void Property3_IdempotentImageCreation()
        {
            var renderer = new DivRenderer();

            Prop.ForAll(GenRGB.ToArbitrary(), rgb =>
            {
                var dom = new VirtualDOM();
                var node = dom.CreateElement(NodeTag.Div);
                node.MarkDirty(DirtyFlags.Style);
                node.InlineStyles["background-color"] =
                    $"#{rgb.r:X2}{rgb.g:X2}{rgb.b:X2}";

                var go = new GameObject("PBT_Div");
                node.RenderHandle = go;

                try
                {
                    renderer.Sync(node);
                    // Re-dirty and sync again
                    node.MarkDirty(DirtyFlags.Style);
                    renderer.Sync(node);

                    var images = go.GetComponents<Image>();
                    return (images.Length == 1)
                        .Label($"Expected 1 Image after double sync, got {images.Length}");
                }
                finally
                {
                    Object.DestroyImmediate(go);
                }
            }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 4: DivRenderer synchronizes background-color.
        /// For any valid hex color, after Sync the Image color matches the parsed value.
        /// **Validates: Requirements 2.2**
        /// </summary>
        [Test]
        public void Property4_SynchronizesBackgroundColor()
        {
            var renderer = new DivRenderer();

            Prop.ForAll(GenRGB.ToArbitrary(), rgb =>
            {
                // Skip (0,0,0) since #000000 parses to black which is not Color.clear
                // but all components are 0 except alpha — this is fine, just test it
                var dom = new VirtualDOM();
                var node = dom.CreateElement(NodeTag.Div);
                node.MarkDirty(DirtyFlags.Style);
                var hex = $"#{rgb.r:X2}{rgb.g:X2}{rgb.b:X2}";
                node.InlineStyles["background-color"] = hex;

                var go = new GameObject("PBT_Div");
                node.RenderHandle = go;

                try
                {
                    renderer.Sync(node);

                    var image = go.GetComponent<Image>();
                    var expected = CSSColorParser.Parse(hex);

                    if (expected == Color.clear)
                    {
                        // Image should be disabled for clear colors
                        return (!image.enabled)
                            .Label($"Image should be disabled for clear color {hex}");
                    }

                    var rOk = Mathf.Abs(image.color.r - expected.r) < 0.01f;
                    var gOk = Mathf.Abs(image.color.g - expected.g) < 0.01f;
                    var bOk = Mathf.Abs(image.color.b - expected.b) < 0.01f;
                    var aOk = Mathf.Abs(image.color.a - expected.a) < 0.01f;

                    return (rOk && gOk && bOk && aOk)
                        .Label($"hex={hex} expected=({expected.r},{expected.g},{expected.b},{expected.a}) " +
                               $"got=({image.color.r},{image.color.g},{image.color.b},{image.color.a})");
                }
                finally
                {
                    Object.DestroyImmediate(go);
                }
            }).QuickCheckThrowOnFailure();
        }
    }
}
