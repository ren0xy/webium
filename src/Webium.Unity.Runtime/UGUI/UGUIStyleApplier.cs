using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Webium.Unity
{
    /// <summary>
    /// Applies cross-cutting CSS properties to any element type.
    /// Called before tag-specific renderers to handle <c>display</c>,
    /// <c>visibility</c>, <c>opacity</c>, <c>font-weight</c>, and <c>font-style</c>.
    /// </summary>
    public static class UGUIStyleApplier
    {
        public static void Apply(GameObject go, Dictionary<string, string> styles)
        {
            if (styles.TryGetValue("display", out var display))
                ApplyDisplay(go, display);

            if (styles.TryGetValue("visibility", out var visibility))
                ApplyVisibility(go, visibility);

            if (styles.TryGetValue("opacity", out var opacity))
                ApplyOpacity(go, opacity);

            if (styles.TryGetValue("font-weight", out var fontWeight))
                ApplyFontWeight(go, fontWeight);

            if (styles.TryGetValue("font-style", out var fontStyle))
                ApplyFontStyle(go, fontStyle);
        }

        private static void ApplyDisplay(GameObject go, string value)
        {
            go.SetActive(value.Trim().ToLowerInvariant() != "none");
        }

        private static void ApplyVisibility(GameObject go, string value)
        {
            bool hidden = value.Trim().ToLowerInvariant() == "hidden";
            float alpha = hidden ? 0f : 1f;
            SetAlphaOnAllGraphics(go, alpha);
        }

        private static void ApplyOpacity(GameObject go, string value)
        {
            if (float.TryParse(value.Trim(), NumberStyles.Float,
                CultureInfo.InvariantCulture, out float opacity))
            {
                opacity = Mathf.Clamp01(opacity);
                SetAlphaOnAllGraphics(go, opacity);
            }
        }

        private static void ApplyFontWeight(GameObject go, string value)
        {
            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp == null) return;

            if (value.Trim().ToLowerInvariant() == "bold" ||
                (int.TryParse(value.Trim(), out int w) && w >= 700))
                tmp.fontStyle |= FontStyles.Bold;
            else
                tmp.fontStyle &= ~FontStyles.Bold;
        }

        private static void ApplyFontStyle(GameObject go, string value)
        {
            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp == null) return;

            if (value.Trim().ToLowerInvariant() == "italic")
                tmp.fontStyle |= FontStyles.Italic;
            else
                tmp.fontStyle &= ~FontStyles.Italic;
        }

        private static void SetAlphaOnAllGraphics(GameObject go, float alpha)
        {
            foreach (var graphic in go.GetComponents<Graphic>())
            {
                var c = graphic.color;
                c.a = alpha;
                graphic.color = c;
            }
        }
    }
}
