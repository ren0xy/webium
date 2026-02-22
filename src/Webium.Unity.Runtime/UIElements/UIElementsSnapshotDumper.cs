using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;
using UnityEngine.UIElements;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Dumps the current UIElements visual tree into a JSON format identical
    /// to the browser reference dump (dump-browser-reference.js) for
    /// side-by-side comparison.
    /// </summary>
    public static class UIElementsSnapshotDumper
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        /// <summary>
        /// Generates a JSON snapshot string from the current UIElements render state.
        /// Format matches dump-browser-reference.js output: an array of objects with
        /// selector, tag, id, textContent, layout, and computedStyles.
        /// </summary>
        public static string Dump(UIElementsRenderCommandExecutor executor)
        {
            if (executor == null) return "[]";

            var nodeElements = executor.NodeElements;
            var nodeTags = executor.NodeTags;

            // Find the Html node as our starting point (mirrors browser's documentElement).
            // Fall back to Body, then to any first node.
            int startNodeId = -1;
            int bodyNodeId = -1;
            foreach (var kv in nodeTags)
            {
                if (kv.Value == NodeTag.Html) { startNodeId = kv.Key; break; }
                if (kv.Value == NodeTag.Body) bodyNodeId = kv.Key;
            }
            if (startNodeId < 0) startNodeId = bodyNodeId;
            if (startNodeId < 0) return "[]";

            var results = new List<string>();
            WalkNode(startNodeId, nodeElements, nodeTags, results);

            var sb = new StringBuilder();
            sb.AppendLine("[");
            for (int i = 0; i < results.Count; i++)
            {
                sb.Append(results[i]);
                if (i < results.Count - 1) sb.AppendLine(",");
                else sb.AppendLine();
            }
            sb.Append("]");
            return sb.ToString();
        }

        private static void WalkNode(int nodeId,
            IReadOnlyDictionary<int, VisualElement> nodeElements,
            IReadOnlyDictionary<int, NodeTag> nodeTags,
            List<string> results)
        {
            if (!nodeTags.TryGetValue(nodeId, out var tag)) return;
            if (!nodeElements.TryGetValue(nodeId, out var ve)) return;

            results.Add(BuildNodeJson(ve, tag));

            // Find child node IDs by walking the visual tree
            var childNodeIds = FindChildNodeIds(ve, nodeElements, nodeId);
            foreach (var childId in childNodeIds)
                WalkNode(childId, nodeElements, nodeTags, results);
        }

        private static List<int> FindChildNodeIds(VisualElement parent,
            IReadOnlyDictionary<int, VisualElement> nodeElements,
            int parentNodeId)
        {
            var result = new List<int>();
            var veToId = new Dictionary<VisualElement, int>();
            foreach (var kv in nodeElements)
                veToId[kv.Value] = kv.Key;

            for (int i = 0; i < parent.childCount; i++)
            {
                var child = parent[i];
                if (child.name == "__WebiumText") continue;
                if (veToId.TryGetValue(child, out var childId) && childId != parentNodeId)
                    result.Add(childId);
            }
            return result;
        }

        private static string BuildNodeJson(VisualElement ve, NodeTag tag)
        {
            var sb = new StringBuilder();
            var tagName = TagToHtml(tag);
            var selector = BuildSelector(ve, tag);
            var textContent = GetTextContent(ve, tag);
            var rect = ve.worldBound;

            sb.AppendLine("  {");
            sb.AppendLine($"    \"selector\": {JsonString(selector)},");
            sb.AppendLine($"    \"tag\": {JsonString(tagName)},");
            sb.AppendLine($"    \"id\": null,");
            if (textContent != null)
                sb.AppendLine($"    \"textContent\": {JsonString(textContent)},");
            else
                sb.AppendLine($"    \"textContent\": null,");

            // Layout — round to 2 decimal places like the JS version
            sb.AppendLine("    \"layout\": {");
            sb.AppendLine($"      \"x\": {Round2(rect.x)},");
            sb.AppendLine($"      \"y\": {Round2(rect.y)},");
            sb.AppendLine($"      \"width\": {Round2(rect.width)},");
            sb.AppendLine($"      \"height\": {Round2(rect.height)}");
            sb.AppendLine("    },");

            // Computed styles — same property set as dump-browser-reference.js
            sb.AppendLine("    \"computedStyles\": {");
            AppendComputedStyles(sb, ve, tag);
            sb.AppendLine("    }");
            sb.Append("  }");

            return sb.ToString();
        }

        private static void AppendComputedStyles(StringBuilder sb, VisualElement ve, NodeTag tag)
        {
            var s = ve.resolvedStyle;
            var entries = new List<string>();

            // --- Inherited properties (from style-inheritance.ts INHERITABLE_PROPERTIES) ---
            entries.Add(StyleEntry("color", FormatColor(s.color)));
            entries.Add(StyleEntry("font-size", FormatPx(s.fontSize)));
            // font-family: UIElements doesn't expose resolved font-family as a string easily
            entries.Add(StyleEntry("font-family", GetFontFamily(s)));
            entries.Add(StyleEntry("font-weight", GetFontWeight(s)));
            entries.Add(StyleEntry("font-style", GetFontStyle(s)));
            // line-height: UIElements doesn't expose a resolved line-height in px
            entries.Add(StyleEntry("line-height", "normal"));
            entries.Add(StyleEntry("text-align", GetTextAlign(ve)));
            entries.Add(StyleEntry("visibility", s.visibility == Visibility.Hidden ? "hidden" : "visible"));
            entries.Add(StyleEntry("cursor", "auto"));
            entries.Add(StyleEntry("direction", "ltr"));
            entries.Add(StyleEntry("letter-spacing", FormatPx(s.letterSpacing)));
            entries.Add(StyleEntry("word-spacing", FormatPx(s.wordSpacing)));
            entries.Add(StyleEntry("white-space", GetWhiteSpace(ve)));

            // --- Non-inherited properties (from style-inheritance.ts INITIAL_VALUES) ---
            entries.Add(StyleEntry("display", s.display == DisplayStyle.None ? "none" : GetDisplayString(tag)));
            entries.Add(StyleEntry("margin-top", FormatPx(s.marginTop)));
            entries.Add(StyleEntry("margin-right", FormatPx(s.marginRight)));
            entries.Add(StyleEntry("margin-bottom", FormatPx(s.marginBottom)));
            entries.Add(StyleEntry("margin-left", FormatPx(s.marginLeft)));
            entries.Add(StyleEntry("padding-top", FormatPx(s.paddingTop)));
            entries.Add(StyleEntry("padding-right", FormatPx(s.paddingRight)));
            entries.Add(StyleEntry("padding-bottom", FormatPx(s.paddingBottom)));
            entries.Add(StyleEntry("padding-left", FormatPx(s.paddingLeft)));
            entries.Add(StyleEntry("border-width", FormatPx(s.borderTopWidth)));
            entries.Add(StyleEntry("background-color", FormatColor(s.backgroundColor)));
            entries.Add(StyleEntry("width", FormatPx(s.width)));
            entries.Add(StyleEntry("height", FormatPx(s.height)));
            entries.Add(StyleEntry("opacity", s.opacity.ToString(Inv)));
            entries.Add(StyleEntry("overflow", GetOverflow(ve)));
            entries.Add(StyleEntry("position", s.position == Position.Absolute ? "absolute" : "relative"));

            // --- Layout properties (from yoga-layout-engine.ts STYLE_SETTERS) ---
            entries.Add(StyleEntry("min-width", FormatPx(s.minWidth.value)));
            entries.Add(StyleEntry("min-height", FormatPx(s.minHeight.value)));
            entries.Add(StyleEntry("max-width", FormatStyleFloat(s.maxWidth)));
            entries.Add(StyleEntry("max-height", FormatStyleFloat(s.maxHeight)));
            entries.Add(StyleEntry("flex-grow", s.flexGrow.ToString(Inv)));
            entries.Add(StyleEntry("flex-shrink", s.flexShrink.ToString(Inv)));
            entries.Add(StyleEntry("flex-basis", FormatStyleFloat(s.flexBasis)));
            entries.Add(StyleEntry("flex-direction", GetFlexDirection(s)));
            entries.Add(StyleEntry("justify-content", GetJustifyContent(s)));
            entries.Add(StyleEntry("align-items", GetAlignItems(s)));
            entries.Add(StyleEntry("align-self", GetAlignSelf(s)));
            entries.Add(StyleEntry("align-content", GetAlignContent(s)));
            entries.Add(StyleEntry("flex-wrap", GetFlexWrap(s)));

            for (int i = 0; i < entries.Count; i++)
            {
                sb.Append("      ");
                sb.Append(entries[i]);
                if (i < entries.Count - 1) sb.AppendLine(",");
                else sb.AppendLine();
            }
        }
        // ── Helpers ──────────────────────────────────────────────────

        private static string BuildSelector(VisualElement ve, NodeTag tag)
        {
            // The JS version builds "tagName#id.class1.class2".
            // We don't have HTML id/class on the Unity side, so we use the tag name
            // and the VisualElement name (which is "Webium_{tag}_{nodeId}").
            return TagToHtml(tag);
        }

        private static string GetTextContent(VisualElement ve, NodeTag tag)
        {
            // Match JS logic: only return text if the element has exactly one
            // child that is a text node.
            if (ve is Label label)
            {
                var text = label.text;
                return string.IsNullOrEmpty(text) ? null : text;
            }

            var textLabel = ve.Q<Label>("__WebiumText");
            if (textLabel != null)
            {
                var text = textLabel.text;
                return string.IsNullOrEmpty(text) ? null : text;
            }

            return null;
        }

        private static string StyleEntry(string prop, string value)
        {
            return $"{JsonString(prop)}: {JsonString(value)}";
        }

        private static string Round2(float v)
        {
            return (Mathf.Round(v * 100f) / 100f).ToString(Inv);
        }

        private static string FormatPx(float px)
        {
            return px.ToString("0.##", Inv) + "px";
        }

        private static string FormatColor(Color c)
        {
            if (c.a >= 1f)
                return $"rgb({Mathf.RoundToInt(c.r * 255)}, {Mathf.RoundToInt(c.g * 255)}, {Mathf.RoundToInt(c.b * 255)})";
            return $"rgba({Mathf.RoundToInt(c.r * 255)}, {Mathf.RoundToInt(c.g * 255)}, {Mathf.RoundToInt(c.b * 255)}, {c.a.ToString("0.##", Inv)})";
        }

        private static string FormatStyleLength(StyleLength sl)
        {
            if (sl.keyword == StyleKeyword.None || sl.keyword == StyleKeyword.Auto)
                return "none";
            return FormatPx(sl.value.value);
        }

        private static string FormatStyleFloat(StyleFloat sf)
        {
            if (sf.keyword == StyleKeyword.None || sf.keyword == StyleKeyword.Auto)
                return "none";
            return FormatPx(sf.value);
        }

        private static string GetOverflow(VisualElement ve)
        {
            // IResolvedStyle doesn't expose overflow directly;
            // read from the inline style instead.
            var o = ve.style.overflow;
            if (o.keyword != StyleKeyword.Undefined && o.keyword != StyleKeyword.Null)
                return o.value == Overflow.Hidden ? "hidden" : "visible";
            return "visible";
        }

        private static string GetFontFamily(IResolvedStyle s)
        {
            // UIElements doesn't expose resolved font-family as a CSS string.
            // Return a placeholder that signals "whatever Unity resolved".
            var font = s.unityFont;
            if (font != null) return font.name;
            var fontDef = s.unityFontDefinition;
            if (fontDef.font != null) return fontDef.font.name;
            return "sans-serif";
        }

        private static string GetFontWeight(IResolvedStyle s)
        {
            var fw = s.unityFontStyleAndWeight;
            if (fw == FontStyle.Bold || fw == FontStyle.BoldAndItalic)
                return "700";
            return "400";
        }

        private static string GetFontStyle(IResolvedStyle s)
        {
            var fw = s.unityFontStyleAndWeight;
            if (fw == FontStyle.Italic || fw == FontStyle.BoldAndItalic)
                return "italic";
            return "normal";
        }

        private static string GetTextAlign(VisualElement ve)
        {
            var ta = ve.resolvedStyle.unityTextAlign;
            switch (ta)
            {
                case TextAnchor.UpperLeft:
                case TextAnchor.MiddleLeft:
                case TextAnchor.LowerLeft:
                    return "left";
                case TextAnchor.UpperCenter:
                case TextAnchor.MiddleCenter:
                case TextAnchor.LowerCenter:
                    return "center";
                case TextAnchor.UpperRight:
                case TextAnchor.MiddleRight:
                case TextAnchor.LowerRight:
                    return "right";
                default:
                    return "start";
            }
        }

        private static string GetWhiteSpace(VisualElement ve)
        {
            var ws = ve.resolvedStyle.whiteSpace;
            switch (ws)
            {
                case WhiteSpace.NoWrap: return "nowrap";
                case WhiteSpace.Normal:
                default: return "normal";
            }
        }

        private static string GetFlexDirection(IResolvedStyle s)
        {
            switch (s.flexDirection)
            {
                case FlexDirection.Row: return "row";
                case FlexDirection.RowReverse: return "row-reverse";
                case FlexDirection.Column: return "column";
                case FlexDirection.ColumnReverse: return "column-reverse";
                default: return "row";
            }
        }

        private static string GetJustifyContent(IResolvedStyle s)
        {
            switch (s.justifyContent)
            {
                case Justify.FlexStart: return "flex-start";
                case Justify.Center: return "center";
                case Justify.FlexEnd: return "flex-end";
                case Justify.SpaceBetween: return "space-between";
                case Justify.SpaceAround: return "space-around";
                default: return "flex-start";
            }
        }

        private static string GetAlignItems(IResolvedStyle s)
        {
            switch (s.alignItems)
            {
                case Align.Auto: return "auto";
                case Align.FlexStart: return "flex-start";
                case Align.Center: return "center";
                case Align.FlexEnd: return "flex-end";
                case Align.Stretch: return "stretch";
                default: return "stretch";
            }
        }

        private static string GetAlignSelf(IResolvedStyle s)
        {
            switch (s.alignSelf)
            {
                case Align.Auto: return "auto";
                case Align.FlexStart: return "flex-start";
                case Align.Center: return "center";
                case Align.FlexEnd: return "flex-end";
                case Align.Stretch: return "stretch";
                default: return "auto";
            }
        }

        private static string GetAlignContent(IResolvedStyle s)
        {
            switch (s.alignContent)
            {
                case Align.Auto: return "auto";
                case Align.FlexStart: return "flex-start";
                case Align.Center: return "center";
                case Align.FlexEnd: return "flex-end";
                case Align.Stretch: return "stretch";
                default: return "flex-start";
            }
        }

        private static string GetFlexWrap(IResolvedStyle s)
        {
            switch (s.flexWrap)
            {
                case Wrap.NoWrap: return "nowrap";
                case Wrap.Wrap: return "wrap";
                case Wrap.WrapReverse: return "wrap-reverse";
                default: return "nowrap";
            }
        }

        private static string GetDisplayString(NodeTag tag)
        {
            switch (tag)
            {
                case NodeTag.Span:
                case NodeTag.Text:
                case NodeTag.A:
                    return "inline";
                case NodeTag.Button:
                    return "inline-block";
                default:
                    return "block";
            }
        }

        private static string TagToHtml(NodeTag tag)
        {
            switch (tag)
            {
                case NodeTag.Div: return "div";
                case NodeTag.Span: return "span";
                case NodeTag.P: return "p";
                case NodeTag.Img: return "img";
                case NodeTag.Text: return "#text";
                case NodeTag.Button: return "button";
                case NodeTag.Input: return "input";
                case NodeTag.A: return "a";
                case NodeTag.Ul: return "ul";
                case NodeTag.Ol: return "ol";
                case NodeTag.Li: return "li";
                case NodeTag.H1: return "h1";
                case NodeTag.H2: return "h2";
                case NodeTag.H3: return "h3";
                case NodeTag.H4: return "h4";
                case NodeTag.H5: return "h5";
                case NodeTag.H6: return "h6";
                case NodeTag.Body: return "body";
                default: return tag.ToString().ToLowerInvariant();
            }
        }

        private static string JsonString(string value)
        {
            if (value == null) return "null";
            return "\"" + value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("\t", "\\t")
                + "\"";
        }
    }
}
