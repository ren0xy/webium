using UnityEngine;
using UnityEngine.UI;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Renders &lt;div&gt; elements by managing an <see cref="Image"/>
    /// component for background-color support.
    /// </summary>
    public class DivRenderer : ITagRenderer
    {
        public void Sync(VirtualNode node)
        {
            if (node.Tag != NodeTag.Div)
                return;

            if ((node.Dirty & DirtyFlags.Style) == 0)
                return;

            var go = node.RenderHandle as GameObject;
            if (go == null)
                return;

            var image = go.GetComponent<Image>();
            if (image == null)
                image = go.AddComponent<Image>();

            if (node.InlineStyles.TryGetValue("background-color", out var bgColor)
                && !string.IsNullOrEmpty(bgColor))
            {
                var color = CSSColorParser.Parse(bgColor);
                if (color == Color.clear)
                {
                    image.enabled = false;
                }
                else
                {
                    image.color = color;
                    image.enabled = true;
                }
            }
            else
            {
                image.enabled = false;
            }
        }
    }
}
