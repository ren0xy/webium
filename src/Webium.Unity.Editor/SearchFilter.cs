using System;
using System.Globalization;
using Webium.Core;

namespace Webium.Editor
{
    public class SearchFilter
    {
        public string Query { get; set; }

        public bool IsActive => !string.IsNullOrEmpty(Query);

        public bool Matches(NodeSnapshot node)
        {
            if (!IsActive) return true;
            if (node == null) return false;

            if (int.TryParse(Query, NumberStyles.Integer, CultureInfo.InvariantCulture, out int id)
                && node.Id == id)
            {
                return true;
            }

            string tagName = node.Tag.ToString();
            if (tagName.IndexOf(Query, StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return true;
            }

            foreach (var kvp in node.Attributes)
            {
                if (kvp.Value != null
                    && kvp.Value.IndexOf(Query, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return true;
                }
            }

            return false;
        }

        public bool MatchesOrHasMatchingDescendant(NodeSnapshot node)
        {
            if (node == null) return false;
            if (Matches(node)) return true;

            foreach (var child in node.Children)
            {
                if (MatchesOrHasMatchingDescendant(child))
                    return true;
            }

            return false;
        }
    }
}
