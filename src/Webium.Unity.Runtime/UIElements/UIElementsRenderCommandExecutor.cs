using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using UnityEngine.UIElements;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Implements IRenderCommandExecutor for Unity UIElements (UI Toolkit).
    /// Deserializes the RenderCommandBuffer and translates each command
    /// to VisualElement tree operations.
    /// </summary>
    public class UIElementsRenderCommandExecutor : IRenderCommandExecutor
    {
        private readonly VisualElement _root;
        private readonly Dictionary<int, VisualElement> _nodeElements = new Dictionary<int, VisualElement>();
        private readonly Dictionary<int, NodeTag> _nodeTags = new Dictionary<int, NodeTag>();

        private static readonly HashSet<NodeTag> TextTags = new HashSet<NodeTag>
        {
            NodeTag.Span, NodeTag.P, NodeTag.Text,
            NodeTag.H1, NodeTag.H2, NodeTag.H3, NodeTag.H4, NodeTag.H5, NodeTag.H6
        };

        private static readonly HashSet<NodeTag> NonVisualTags = new HashSet<NodeTag>
        {
            NodeTag.Style, NodeTag.Script, NodeTag.Link
        };

        private static readonly Dictionary<NodeTag, float> HeadingDefaultSizes = new()
        {
            { NodeTag.H1, 32f },
            { NodeTag.H2, 24f },
            { NodeTag.H3, 18.72f },
            { NodeTag.H4, 16f },
            { NodeTag.H5, 13.28f },
            { NodeTag.H6, 10.72f },
        };

        public IReadOnlyDictionary<int, VisualElement> NodeElements => _nodeElements;
        public IReadOnlyDictionary<int, NodeTag> NodeTags => _nodeTags;
        public VisualElement Root => _root;

        public UIElementsRenderCommandExecutor(VisualElement root)
        {
            _root = root;
        }

        public void Execute(ReadOnlySpan<byte> commandBuffer)
        {
            var commands = RenderCommandDeserializer.Deserialize(commandBuffer);
            foreach (var cmd in commands)
            {
                switch (cmd.Op)
                {
                    case RenderOp.Create:
                        ExecuteCreate(cmd);
                        break;
                    case RenderOp.Destroy:
                        ExecuteDestroy(cmd);
                        break;
                    case RenderOp.UpdateLayout:
                        ExecuteUpdateLayout(cmd);
                        break;
                    case RenderOp.UpdateStyle:
                        ExecuteUpdateStyle(cmd);
                        break;
                    case RenderOp.UpdateText:
                        ExecuteUpdateText(cmd);
                        break;
                    case RenderOp.Reparent:
                        ExecuteReparent(cmd);
                        break;
                }
            }
        }

        private void ExecuteCreate(RenderCommand cmd)
        {
            var tag = cmd.Tag ?? NodeTag.Unknown;

            // Non-visual tags: skip entirely
            if (NonVisualTags.Contains(tag))
            {
                _nodeTags[cmd.NodeId] = tag;
                return;
            }

            var ve = CreateElementForTag(tag);
            ve.name = $"Webium_{tag}_{cmd.NodeId}";

            VisualElement parent = _root;
            if (cmd.ParentId.HasValue && _nodeElements.TryGetValue(cmd.ParentId.Value, out var parentVE))
                parent = parentVE;

            if (cmd.SiblingIndex.HasValue)
            {
                var idx = Math.Min(cmd.SiblingIndex.Value, parent.childCount);
                parent.Insert(idx, ve);
            }
            else
                parent.Add(ve);

            _nodeElements[cmd.NodeId] = ve;
            _nodeTags[cmd.NodeId] = tag;
        }

        private void ExecuteDestroy(RenderCommand cmd)
        {
            if (_nodeElements.TryGetValue(cmd.NodeId, out var ve))
            {
                ve.RemoveFromHierarchy();
                _nodeElements.Remove(cmd.NodeId);
            }
            _nodeTags.Remove(cmd.NodeId);
        }

        private void ExecuteReparent(RenderCommand cmd)
        {
            if (!_nodeElements.TryGetValue(cmd.NodeId, out var ve)) return;

            ve.RemoveFromHierarchy();

            VisualElement newParent = _root;
            if (cmd.ParentId.HasValue && _nodeElements.TryGetValue(cmd.ParentId.Value, out var parentVE))
                newParent = parentVE;

            if (cmd.SiblingIndex.HasValue)
            {
                var idx = Math.Min(cmd.SiblingIndex.Value, newParent.childCount);
                newParent.Insert(idx, ve);
            }
            else
                newParent.Add(ve);
        }

        private void ExecuteUpdateLayout(RenderCommand cmd)
        {
            if (!_nodeElements.TryGetValue(cmd.NodeId, out var ve)) return;
            ve.style.position = Position.Absolute;
            ve.style.left = cmd.X ?? 0;
            ve.style.top = cmd.Y ?? 0;
            ve.style.width = cmd.Width ?? 0;
            ve.style.height = cmd.Height ?? 0;
        }

        private void ExecuteUpdateStyle(RenderCommand cmd)
        {
            if (!_nodeElements.TryGetValue(cmd.NodeId, out var ve)) return;
            if (cmd.Styles == null) return;

            if (cmd.Styles.TryGetValue("background-color", out var bgColor))
            {
                var color = CSSColorParser.Parse(bgColor);
                ve.style.backgroundColor = color;
            }

            if (cmd.Styles.TryGetValue("color", out var textColor))
            {
                var color = CSSColorParser.Parse(textColor);
                ve.style.color = color;
            }

            if (cmd.Styles.TryGetValue("font-size", out var fontSize))
            {
                var px = CSSUnitParser.ParsePx(fontSize);
                if (px > 0f)
                    ve.style.fontSize = px;
            }

            if (cmd.Styles.TryGetValue("opacity", out var opacity))
            {
                if (float.TryParse(opacity.Trim(), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out float opacityVal))
                {
                    ve.style.opacity = Mathf.Clamp01(opacityVal);
                }
            }

            if (cmd.Styles.TryGetValue("display", out var display))
            {
                ve.style.display = display.Trim().ToLowerInvariant() == "none"
                    ? DisplayStyle.None
                    : DisplayStyle.Flex;
            }

            if (cmd.Styles.TryGetValue("visibility", out var visibility))
            {
                ve.style.visibility = visibility.Trim().ToLowerInvariant() == "hidden"
                    ? Visibility.Hidden
                    : Visibility.Visible;
            }

            if (cmd.Styles.TryGetValue("font-weight", out var fontWeight))
                ApplyFontWeight(ve, fontWeight);

            if (cmd.Styles.TryGetValue("font-style", out var fontStyle))
                ApplyFontStyle(ve, fontStyle);

            if (cmd.Styles.TryGetValue("font-family", out var fontFamily))
            {
                var font = CSSFontFamilyResolver.ResolveFont(fontFamily);
                if (font != null)
                    ve.style.unityFontDefinition = FontDefinition.FromFont(font);
            }

            // Individual padding properties (from shorthand expansion)
            if (cmd.Styles.TryGetValue("padding-top", out var pt))
                ve.style.paddingTop = CSSUnitParser.ParsePx(pt);
            if (cmd.Styles.TryGetValue("padding-right", out var pr))
                ve.style.paddingRight = CSSUnitParser.ParsePx(pr);
            if (cmd.Styles.TryGetValue("padding-bottom", out var pb))
                ve.style.paddingBottom = CSSUnitParser.ParsePx(pb);
            if (cmd.Styles.TryGetValue("padding-left", out var pl))
                ve.style.paddingLeft = CSSUnitParser.ParsePx(pl);

            // Shorthand fallback for backward compatibility
            if (cmd.Styles.TryGetValue("padding", out var padding))
                ApplyPadding(ve, padding);

            // NOTE: Margins are intentionally NOT applied here.
            // Yoga already accounts for margins when computing absolute x/y positions
            // in ExecuteUpdateLayout. Applying them again in UIElements would double-count.

            // Border widths — applied visually (Yoga already accounts for them in layout)
            bool hasBorderWidth = false;
            if (cmd.Styles.TryGetValue("border-top-width", out var btw))
            { ve.style.borderTopWidth = CSSUnitParser.ParsePx(btw); hasBorderWidth = true; }
            if (cmd.Styles.TryGetValue("border-right-width", out var brw))
            { ve.style.borderRightWidth = CSSUnitParser.ParsePx(brw); hasBorderWidth = true; }
            if (cmd.Styles.TryGetValue("border-bottom-width", out var bbw))
            { ve.style.borderBottomWidth = CSSUnitParser.ParsePx(bbw); hasBorderWidth = true; }
            if (cmd.Styles.TryGetValue("border-left-width", out var blw))
            { ve.style.borderLeftWidth = CSSUnitParser.ParsePx(blw); hasBorderWidth = true; }

            // Border color — explicit or default to currentColor (text color)
            if (cmd.Styles.TryGetValue("border-color", out var bc))
            {
                var borderColor = CSSColorParser.Parse(bc);
                ve.style.borderTopColor = borderColor;
                ve.style.borderRightColor = borderColor;
                ve.style.borderBottomColor = borderColor;
                ve.style.borderLeftColor = borderColor;
            }
            else if (hasBorderWidth)
            {
                // CSS default: border-color is currentColor (the element's text color)
                var currentColor = ve.resolvedStyle.color;
                ve.style.borderTopColor = currentColor;
                ve.style.borderRightColor = currentColor;
                ve.style.borderBottomColor = currentColor;
                ve.style.borderLeftColor = currentColor;
            }
        }

        private static void ApplyFontWeight(VisualElement ve, string value)
        {
            var trimmed = value.Trim().ToLowerInvariant();
            bool bold = trimmed == "bold" ||
                        (int.TryParse(trimmed, out int w) && w >= 700);

            if (bold)
                ve.style.unityFontStyleAndWeight = FontStyle.Bold;
            else
                ve.style.unityFontStyleAndWeight = FontStyle.Normal;
        }

        private static void ApplyFontStyle(VisualElement ve, string value)
        {
            if (value.Trim().ToLowerInvariant() == "italic")
                ve.style.unityFontStyleAndWeight = FontStyle.Italic;
            else
                ve.style.unityFontStyleAndWeight = FontStyle.Normal;
        }

        private static void ApplyPadding(VisualElement ve, string value)
        {
            var px = CSSUnitParser.ParsePx(value);
            ve.style.paddingTop = px;
            ve.style.paddingRight = px;
            ve.style.paddingBottom = px;
            ve.style.paddingLeft = px;
        }


        private void ExecuteUpdateText(RenderCommand cmd)
        {
            if (!_nodeElements.TryGetValue(cmd.NodeId, out var ve)) return;
            var text = cmd.Text ?? string.Empty;

            _nodeTags.TryGetValue(cmd.NodeId, out var tag);

            if (TextTags.Contains(tag))
            {
                // Text elements: set text on Label directly
                if (ve is Label label)
                    label.text = text;
            }
            else
            {
                // Non-text elements: ignore if element has child elements
                if (ve.childCount > 0)
                {
                    // Check if the only child is our __WebiumText label
                    var existing = ve.Q<Label>("__WebiumText");
                    if (existing != null)
                    {
                        existing.text = text;
                        return;
                    }
                    return;
                }

                // No children: create or update a child text label
                var childLabel = ve.Q<Label>("__WebiumText");
                if (childLabel == null)
                {
                    childLabel = new Label(text);
                    childLabel.name = "__WebiumText";
                    childLabel.style.position = Position.Absolute;
                    childLabel.style.left = 0;
                    childLabel.style.top = 0;
                    childLabel.style.right = 0;
                    childLabel.style.bottom = 0;
                    ve.Add(childLabel);
                }
                else
                {
                    childLabel.text = text;
                }
            }
        }

        private static VisualElement CreateElementForTag(NodeTag tag)
        {
            switch (tag)
            {
                // Container tags
                case NodeTag.Div:
                case NodeTag.Body:
                case NodeTag.Html:
                case NodeTag.Ul:
                case NodeTag.Ol:
                case NodeTag.Li:
                    return new VisualElement();

                // Non-visual structural tags — bare VisualElement, display:none set via style
                case NodeTag.Head:
                case NodeTag.Link:
                case NodeTag.Script:
                case NodeTag.Style:
                    return new VisualElement();

                // Text tags — reset Label theme defaults so CSS styles apply cleanly
                case NodeTag.Span:
                case NodeTag.P:
                case NodeTag.Text:
                {
                    var label = new Label();
                    label.style.paddingTop = 0;
                    label.style.paddingRight = 0;
                    label.style.paddingBottom = 0;
                    label.style.paddingLeft = 0;
                    label.style.marginTop = 0;
                    label.style.marginRight = 0;
                    label.style.marginBottom = 0;
                    label.style.marginLeft = 0;
                    return label;
                }

                // Heading tags — Label with bold + default font size
                case NodeTag.H1:
                case NodeTag.H2:
                case NodeTag.H3:
                case NodeTag.H4:
                case NodeTag.H5:
                case NodeTag.H6:
                {
                    var label = new Label();
                    label.style.unityFontStyleAndWeight = FontStyle.Bold;
                    if (HeadingDefaultSizes.TryGetValue(tag, out var size))
                        label.style.fontSize = size;
                    // Reset Label theme defaults so CSS styles apply cleanly
                    label.style.paddingTop = 0;
                    label.style.paddingRight = 0;
                    label.style.paddingBottom = 0;
                    label.style.paddingLeft = 0;
                    label.style.marginTop = 0;
                    label.style.marginRight = 0;
                    label.style.marginBottom = 0;
                    label.style.marginLeft = 0;
                    return label;
                }

                // Clickable tags — use bare VisualElement since Yoga handles all layout.
                // UIElements.Button has internal children (TextElement) that add unwanted spacing.
                case NodeTag.Button:
                case NodeTag.A:
                    return new VisualElement();

                // Input tag
                case NodeTag.Input:
                    return new TextField();

                // Image tag — bare VisualElement, backgroundImage set later via style
                case NodeTag.Img:
                    return new VisualElement();

                // Unknown tag
                case NodeTag.Unknown:
                default:
                    Debug.LogWarning($"[Webium] Unknown tag for node, creating bare VisualElement");
                    return new VisualElement();
            }
        }
    }
}
