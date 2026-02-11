using Webium.Core;

namespace Webium.Editor
{
    public static class DOMTreeFormatter
    {
        public static string FormatNodeLabel(NodeSnapshot node)
        {
            if (node == null) return string.Empty;

            if (node.Tag == NodeTag.Text)
            {
                string text = node.TextContent ?? string.Empty;
                if (text.Length > 20)
                    text = text.Substring(0, 20) + "\u2026";
                return $"#text \"{text}\"";
            }

            return $"<{node.Tag}> #{node.Id}";
        }
    }
}
