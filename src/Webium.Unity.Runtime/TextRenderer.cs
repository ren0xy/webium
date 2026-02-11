using TMPro;
using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Renders text-bearing elements (&lt;span&gt;, &lt;p&gt;, #text)
    /// by managing a <see cref="TextMeshProUGUI"/> component.
    /// </summary>
    public class TextRenderer : ITagRenderer
    {
        public void Sync(VirtualNode node)
        {
            if (node.Tag != NodeTag.Span && node.Tag != NodeTag.P && node.Tag != NodeTag.Text)
                return;

            if ((node.Dirty & (DirtyFlags.Text | DirtyFlags.Style)) == 0)
                return;

            var go = node.RenderHandle as GameObject;
            if (go == null)
                return;

            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp == null)
                tmp = go.AddComponent<TextMeshProUGUI>();

            tmp.text = node.TextContent;

            if (node.InlineStyles.TryGetValue("color", out var color))
                tmp.color = CSSColorParser.Parse(color);

            if (node.InlineStyles.TryGetValue("font-size", out var fontSize))
            {
                var px = CSSUnitParser.ParsePx(fontSize);
                if (px > 0f)
                    tmp.fontSize = px;
            }

            if (node.InlineStyles.TryGetValue("text-align", out var align))
            {
                switch (align.Trim().ToLowerInvariant())
                {
                    case "left":
                        tmp.alignment = TextAlignmentOptions.Left;
                        break;
                    case "center":
                        tmp.alignment = TextAlignmentOptions.Center;
                        break;
                    case "right":
                        tmp.alignment = TextAlignmentOptions.Right;
                        break;
                    case "justify":
                        tmp.alignment = TextAlignmentOptions.Justified;
                        break;
                }
            }
        }
    }
}
