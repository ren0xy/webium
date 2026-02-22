using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// UIElements text measurer using Unity's Font API for per-character advance measurement.
    /// </summary>
    public class UIElementsTextMeasurer : ITextMeasurer
    {
        public TextMeasurement Measure(string text, string fontFamily, float fontSize, string fontWeight, string fontStyle)
        {
            var font = CSSFontFamilyResolver.ResolveFont(fontFamily);
            if (font == null) font = Font.CreateDynamicFontFromOSFont("Arial", Mathf.RoundToInt(fontSize));

            var style = ResolveFontStyle(fontWeight, fontStyle);
            var size = Mathf.RoundToInt(fontSize);

            font.RequestCharactersInTexture(text, size, style);

            float width = 0f;
            for (int i = 0; i < text.Length; i++)
            {
                if (font.GetCharacterInfo(text[i], out var info, size, style))
                    width += info.advance;
            }

            // font.lineHeight reflects the font's default/creation size, not the
            // requested size. Scale proportionally when font.fontSize is known.
            float lineHeight;
            if (font.fontSize > 0 && font.lineHeight > 0)
                lineHeight = font.lineHeight * (fontSize / font.fontSize);
            else if (font.lineHeight > 0)
                lineHeight = font.lineHeight;
            else
                lineHeight = fontSize * 1.2f;
            return new TextMeasurement { Width = width, Height = lineHeight };
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
