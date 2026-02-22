using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// UGUI text measurer using Unity's TextGenerator API for measurement.
    /// </summary>
    public class UGUITextMeasurer : ITextMeasurer
    {
        public TextMeasurement Measure(string text, string fontFamily, float fontSize, string fontWeight, string fontStyle)
        {
            var font = CSSFontFamilyResolver.ResolveFont(fontFamily);
            if (font == null) font = Font.CreateDynamicFontFromOSFont("Arial", Mathf.RoundToInt(fontSize));

            var settings = new TextGenerationSettings
            {
                font = font,
                fontSize = Mathf.RoundToInt(fontSize),
                fontStyle = ResolveFontStyle(fontWeight, fontStyle),
                richText = false,
                scaleFactor = 1f,
                generationExtents = new Vector2(10000f, 10000f),
                textAnchor = TextAnchor.UpperLeft,
                horizontalOverflow = HorizontalWrapMode.Overflow,
                verticalOverflow = VerticalWrapMode.Overflow,
            };

            var generator = new TextGenerator();
            float width = generator.GetPreferredWidth(text, settings);

            // Use font line-height (not GetPreferredHeight) so the measured
            // height matches CSS line-height:normal (~1.2× font-size).
            // GetPreferredHeight returns tight glyph bounds which are shorter
            // than the browser's line box.
            float height;
            if (font.fontSize > 0 && font.lineHeight > 0)
                height = font.lineHeight * (fontSize / font.fontSize);
            else if (font.lineHeight > 0)
                height = font.lineHeight;
            else
                height = fontSize * 1.2f;

            return new TextMeasurement { Width = width, Height = height };
        }

        private static FontStyle ResolveFontStyle(string fontWeight, string fontStyle)
        {
            bool bold = fontWeight == "bold" || (int.TryParse(fontWeight, out var w) && w >= 700);
            bool italic = fontStyle == "italic" || fontStyle == "oblique";
            if (bold && italic) return FontStyle.BoldAndItalic;
            if (bold) return FontStyle.Bold;
            if (italic) return FontStyle.Italic;
            return FontStyle.Normal;
        }
    }
}
