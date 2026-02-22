using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Dumps the current UGUI render tree into the same JSON format as
    /// <see cref="UIElementsSnapshotDumper"/> (UIElements) for side-by-side
    /// comparison with browser reference dumps.
    /// </summary>
    public static class UGUISnapshotDumper
    {
        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        private static readonly HashSet<NodeTag> TextTags = new HashSet<NodeTag>
        {
            NodeTag.Span, NodeTag.P, NodeTag.Text,
            NodeTag.H1, NodeTag.H2, NodeTag.H3, NodeTag.H4, NodeTag.H5, NodeTag.H6
        };

        public static string Dump(UGUIRenderCommandExecutor executor)
        {
            if (executor == null) return "[]";

            var nodeObjects = executor.NodeObjects;
            var nodeTags = executor.NodeTags;

            // Find Html node, fall back to Body
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
            WalkNode(startNodeId, nodeObjects, nodeTags, executor.AppliedStyles, results);

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
            IReadOnlyDictionary<int, GameObject> nodeObjects,
            IReadOnlyDictionary<int, NodeTag> nodeTags,
            IReadOnlyDictionary<int, Dictionary<string, string>> appliedStyles,
            List<string> results)
        {
            if (!nodeTags.TryGetValue(nodeId, out var tag)) return;
            if (!nodeObjects.TryGetValue(nodeId, out var go)) return;

            var styles = appliedStyles.TryGetValue(nodeId, out var s) ? s : null;
            results.Add(BuildNodeJson(go, tag, styles));

            // Find child node IDs by walking the transform hierarchy
            var childNodeIds = FindChildNodeIds(go.transform, nodeObjects, nodeId);
            foreach (var childId in childNodeIds)
                WalkNode(childId, nodeObjects, nodeTags, appliedStyles, results);
        }

        private static List<int> FindChildNodeIds(Transform parent,
            IReadOnlyDictionary<int, GameObject> nodeObjects,
            int parentNodeId)
        {
            var result = new List<int>();
            var goToId = new Dictionary<GameObject, int>();
            foreach (var kv in nodeObjects)
                goToId[kv.Value] = kv.Key;

            for (int i = 0; i < parent.childCount; i++)
            {
                var child = parent.GetChild(i).gameObject;
                if (child.name == "__WebiumText") continue;
                if (child.name == "Text Area") continue; // TMP_InputField internals
                if (goToId.TryGetValue(child, out var childId) && childId != parentNodeId)
                    result.Add(childId);
            }
            return result;
        }

        private static string BuildNodeJson(GameObject go, NodeTag tag, Dictionary<string, string> styles)
        {
            var sb = new StringBuilder();
            var tagName = TagToHtml(tag);
            var selector = tagName;
            var textContent = GetTextContent(go, tag);
            var rt = go.GetComponent<RectTransform>();

            // Compute world-space rect for layout
            float x = 0, y = 0, w = 0, h = 0;
            if (rt != null)
            {
                var corners = new Vector3[4];
                rt.GetWorldCorners(corners);
                // corners: 0=bottom-left, 1=top-left, 2=top-right, 3=bottom-right
                x = corners[0].x;
                y = Screen.height - corners[1].y; // flip Y to match top-left origin
                w = corners[2].x - corners[0].x;
                h = corners[1].y - corners[0].y;
            }

            sb.AppendLine("  {");
            sb.AppendLine($"    \"selector\": {JsonString(selector)},");
            sb.AppendLine($"    \"tag\": {JsonString(tagName)},");
            sb.AppendLine($"    \"id\": null,");
            if (textContent != null)
                sb.AppendLine($"    \"textContent\": {JsonString(textContent)},");
            else
                sb.AppendLine($"    \"textContent\": null,");

            sb.AppendLine("    \"layout\": {");
            sb.AppendLine($"      \"x\": {Round2(x)},");
            sb.AppendLine($"      \"y\": {Round2(y)},");
            sb.AppendLine($"      \"width\": {Round2(w)},");
            sb.AppendLine($"      \"height\": {Round2(h)}");
            sb.AppendLine("    },");

            sb.AppendLine("    \"computedStyles\": {");
            AppendComputedStyles(sb, go, tag, styles);
            sb.AppendLine("    }");
            sb.Append("  }");

            return sb.ToString();
        }

        private static void AppendComputedStyles(StringBuilder sb, GameObject go, NodeTag tag,
            Dictionary<string, string> styles)
        {
            var entries = new List<string>();
            var rt = go.GetComponent<RectTransform>();
            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp == null)
            {
                var child = go.transform.Find("__WebiumText");
                if (child != null) tmp = child.GetComponent<TextMeshProUGUI>();
            }
            var image = go.GetComponent<Image>();

            // --- Inherited properties ---
            entries.Add(SE("color", tmp != null ? FormatColor(tmp.color) : S(styles, "color", "rgb(0, 0, 0)")));
            entries.Add(SE("font-size", tmp != null ? FormatPx(tmp.fontSize) : S(styles, "font-size", "16px")));
            entries.Add(SE("font-family", tmp != null && tmp.font != null ? tmp.font.name : S(styles, "font-family", "sans-serif")));
            entries.Add(SE("font-weight", GetFontWeight(tmp, styles)));
            entries.Add(SE("font-style", GetFontStyle(tmp, styles)));
            entries.Add(SE("line-height", "normal"));
            entries.Add(SE("text-align", GetTextAlign(tmp)));
            entries.Add(SE("visibility", go.activeInHierarchy ? "visible" : "hidden"));
            entries.Add(SE("cursor", "auto"));
            entries.Add(SE("direction", "ltr"));
            entries.Add(SE("letter-spacing", "0px"));
            entries.Add(SE("word-spacing", "0px"));
            entries.Add(SE("white-space", "normal"));

            // --- Non-inherited properties ---
            entries.Add(SE("display", !go.activeSelf ? "none" : GetDisplayString(tag)));
            // UGUI layout is absolute-positioned by Yoga; margins/padding are baked into position
            entries.Add(SE("margin-top", S(styles, "margin-top", "0px")));
            entries.Add(SE("margin-right", S(styles, "margin-right", "0px")));
            entries.Add(SE("margin-bottom", S(styles, "margin-bottom", "0px")));
            entries.Add(SE("margin-left", S(styles, "margin-left", "0px")));
            entries.Add(SE("padding-top", S(styles, "padding-top", "0px")));
            entries.Add(SE("padding-right", S(styles, "padding-right", "0px")));
            entries.Add(SE("padding-bottom", S(styles, "padding-bottom", "0px")));
            entries.Add(SE("padding-left", S(styles, "padding-left", "0px")));
            entries.Add(SE("border-width", S(styles, "border-width", "0px")));
            entries.Add(SE("background-color", image != null ? FormatColor(image.color) : S(styles, "background-color", "rgba(0, 0, 0, 0)")));
            entries.Add(SE("width", rt != null ? FormatPx(rt.sizeDelta.x) : "0px"));
            entries.Add(SE("height", rt != null ? FormatPx(rt.sizeDelta.y) : "0px"));
            entries.Add(SE("opacity", S(styles, "opacity", "1")));
            entries.Add(SE("overflow", S(styles, "overflow", "visible")));
            entries.Add(SE("position", S(styles, "position", "relative")));

            // --- Layout / flex properties (from cached CSS styles) ---
            entries.Add(SE("min-width", S(styles, "min-width", "0px")));
            entries.Add(SE("min-height", S(styles, "min-height", "0px")));
            entries.Add(SE("max-width", S(styles, "max-width", "none")));
            entries.Add(SE("max-height", S(styles, "max-height", "none")));
            entries.Add(SE("flex-grow", S(styles, "flex-grow", "0")));
            entries.Add(SE("flex-shrink", S(styles, "flex-shrink", "1")));
            entries.Add(SE("flex-basis", S(styles, "flex-basis", "none")));
            entries.Add(SE("flex-direction", S(styles, "flex-direction", "row")));
            entries.Add(SE("justify-content", S(styles, "justify-content", "flex-start")));
            entries.Add(SE("align-items", S(styles, "align-items", "stretch")));
            entries.Add(SE("align-self", S(styles, "align-self", "auto")));
            entries.Add(SE("align-content", S(styles, "align-content", "flex-start")));
            entries.Add(SE("flex-wrap", S(styles, "flex-wrap", "nowrap")));

            for (int i = 0; i < entries.Count; i++)
            {
                sb.Append("      ");
                sb.Append(entries[i]);
                if (i < entries.Count - 1) sb.AppendLine(",");
                else sb.AppendLine();
            }
        }

        // ── Helpers ──────────────────────────────────────────────────

        /// <summary>Look up a cached CSS style value, with fallback default.</summary>
        private static string S(Dictionary<string, string> styles, string key, string fallback)
        {
            if (styles != null && styles.TryGetValue(key, out var v)) return v;
            return fallback;
        }

        /// <summary>Style entry shorthand.</summary>
        private static string SE(string prop, string value)
        {
            return $"{JsonString(prop)}: {JsonString(value)}";
        }

        private static string GetTextContent(GameObject go, NodeTag tag)
        {
            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp != null && !string.IsNullOrEmpty(tmp.text))
                return tmp.text;

            var child = go.transform.Find("__WebiumText");
            if (child != null)
            {
                tmp = child.GetComponent<TextMeshProUGUI>();
                if (tmp != null && !string.IsNullOrEmpty(tmp.text))
                    return tmp.text;
            }
            return null;
        }

        private static string GetFontWeight(TextMeshProUGUI tmp, Dictionary<string, string> styles)
        {
            if (tmp != null && (tmp.fontStyle & FontStyles.Bold) != 0) return "700";
            if (styles != null && styles.TryGetValue("font-weight", out var fw)) return fw;
            return "400";
        }

        private static string GetFontStyle(TextMeshProUGUI tmp, Dictionary<string, string> styles)
        {
            if (tmp != null && (tmp.fontStyle & FontStyles.Italic) != 0) return "italic";
            if (styles != null && styles.TryGetValue("font-style", out var fs)) return fs;
            return "normal";
        }

        private static string GetTextAlign(TextMeshProUGUI tmp)
        {
            if (tmp == null) return "start";
            var a = tmp.alignment;
            if ((a & TextAlignmentOptions.Left) != 0) return "left";
            if ((a & TextAlignmentOptions.Center) != 0) return "center";
            if ((a & TextAlignmentOptions.Right) != 0) return "right";
            return "start";
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
