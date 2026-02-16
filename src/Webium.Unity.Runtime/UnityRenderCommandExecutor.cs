using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Implements IRenderCommandExecutor for Unity.
    /// Deserializes the RenderCommandBuffer and translates each command
    /// to GameObject/RectTransform operations.
    /// </summary>
    public class UnityRenderCommandExecutor : IRenderCommandExecutor
    {
        private readonly Transform _rootTransform;
        private readonly Dictionary<int, GameObject> _nodeObjects = new Dictionary<int, GameObject>();
        private readonly Dictionary<int, NodeTag> _nodeTags = new Dictionary<int, NodeTag>();

        private static readonly HashSet<NodeTag> TextTags = new HashSet<NodeTag>
        {
            NodeTag.Span, NodeTag.P, NodeTag.Text,
            NodeTag.H1, NodeTag.H2, NodeTag.H3, NodeTag.H4, NodeTag.H5, NodeTag.H6
        };

        public IReadOnlyDictionary<int, GameObject> NodeObjects => _nodeObjects;

        public UnityRenderCommandExecutor(Transform rootTransform)
        {
            _rootTransform = rootTransform;
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
            var go = new GameObject($"Webium_{tag}_{cmd.NodeId}");
            go.AddComponent<RectTransform>();

            Transform parent = _rootTransform;
            if (cmd.ParentId.HasValue && _nodeObjects.TryGetValue(cmd.ParentId.Value, out var parentGo))
                parent = parentGo.transform;

            go.transform.SetParent(parent, false);
            if (cmd.SiblingIndex.HasValue)
                go.transform.SetSiblingIndex(cmd.SiblingIndex.Value);

            AddVisualComponents(go, tag);

            _nodeObjects[cmd.NodeId] = go;
            _nodeTags[cmd.NodeId] = tag;
        }

        private void ExecuteDestroy(RenderCommand cmd)
        {
            if (_nodeObjects.TryGetValue(cmd.NodeId, out var go))
            {
                UnityEngine.Object.Destroy(go);
                _nodeObjects.Remove(cmd.NodeId);
                _nodeTags.Remove(cmd.NodeId);
            }
        }

        private void ExecuteUpdateLayout(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;
            var rt = go.GetComponent<RectTransform>();
            if (rt == null) return;

            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(cmd.X ?? 0, -(cmd.Y ?? 0));
            rt.sizeDelta = new Vector2(cmd.Width ?? 0, cmd.Height ?? 0);
        }

        private void ExecuteUpdateStyle(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;
            if (cmd.Styles == null) return;

            // Apply cross-cutting styles (display, visibility, opacity, font-weight, font-style)
            CommonStyleApplier.Apply(go, cmd.Styles);

            // Extended CSS properties
            if (cmd.Styles.TryGetValue("background-color", out var bgColor))
                ApplyBackgroundColor(go, bgColor);

            if (cmd.Styles.TryGetValue("color", out var color))
                ApplyTextColor(go, color);

            if (cmd.Styles.TryGetValue("font-size", out var fontSize))
                ApplyFontSize(go, fontSize);

            if (cmd.Styles.TryGetValue("padding", out var padding))
                ApplyPadding(go, padding);
        }

        private void ExecuteUpdateText(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;
            var text = cmd.Text ?? string.Empty;

            // Determine if this is a text element
            _nodeTags.TryGetValue(cmd.NodeId, out var tag);

            if (TextTags.Contains(tag))
            {
                // Text elements: set text on TextMeshProUGUI directly
                var tmp = go.GetComponent<TextMeshProUGUI>();
                if (tmp != null)
                    tmp.text = text;
            }
            else
            {
                // Non-text elements: ignore if element has child elements
                if (go.transform.childCount > 0)
                    return;

                // No children: create or update a child text component
                var childText = go.transform.Find("__WebiumText");
                if (childText == null)
                {
                    var textGo = new GameObject("__WebiumText");
                    textGo.transform.SetParent(go.transform, false);
                    var rt = textGo.AddComponent<RectTransform>();
                    rt.anchorMin = Vector2.zero;
                    rt.anchorMax = Vector2.one;
                    rt.sizeDelta = Vector2.zero;
                    var tmp = textGo.AddComponent<TextMeshProUGUI>();
                    tmp.text = text;
                }
                else
                {
                    var tmp = childText.GetComponent<TextMeshProUGUI>();
                    if (tmp != null)
                        tmp.text = text;
                }
            }
        }

        private void ExecuteReparent(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;

            Transform newParent = _rootTransform;
            if (cmd.ParentId.HasValue && _nodeObjects.TryGetValue(cmd.ParentId.Value, out var parentGo))
                newParent = parentGo.transform;

            go.transform.SetParent(newParent, false);
            if (cmd.SiblingIndex.HasValue)
                go.transform.SetSiblingIndex(cmd.SiblingIndex.Value);
        }

        private void AddVisualComponents(GameObject go, NodeTag tag)
        {
            switch (tag)
            {
                case NodeTag.Div:
                case NodeTag.Body:
                case NodeTag.Ul:
                case NodeTag.Ol:
                case NodeTag.Li:
                    AddContainerComponents(go);
                    break;

                case NodeTag.Span:
                case NodeTag.P:
                case NodeTag.Text:
                    go.AddComponent<TextMeshProUGUI>();
                    break;

                case NodeTag.H1:
                case NodeTag.H2:
                case NodeTag.H3:
                case NodeTag.H4:
                case NodeTag.H5:
                case NodeTag.H6:
                    AddHeadingComponents(go, tag);
                    break;

                case NodeTag.Button:
                case NodeTag.A:
                    AddButtonComponents(go);
                    break;

                case NodeTag.Input:
                    AddInputComponents(go);
                    break;

                case NodeTag.Img:
                    go.AddComponent<RawImage>();
                    break;

                case NodeTag.Unknown:
                    Debug.LogWarning($"[Webium] Unknown tag for node, creating bare RectTransform");
                    break;

                // Non-visual tags: Style, Script, Link, Head, Html — no components
                case NodeTag.Style:
                case NodeTag.Script:
                case NodeTag.Link:
                case NodeTag.Head:
                case NodeTag.Html:
                    break;
            }
        }

        private static void AddContainerComponents(GameObject go)
        {
            var image = go.AddComponent<Image>();
            image.color = new Color(0, 0, 0, 0);
            image.raycastTarget = true;
        }

        private static readonly Dictionary<NodeTag, float> HeadingDefaultSizes = new()
        {
            { NodeTag.H1, 32f },
            { NodeTag.H2, 24f },
            { NodeTag.H3, 18.72f },
            { NodeTag.H4, 16f },
            { NodeTag.H5, 13.28f },
            { NodeTag.H6, 10.72f },
        };

        private static void AddHeadingComponents(GameObject go, NodeTag tag)
        {
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.fontStyle = FontStyles.Bold;
            if (HeadingDefaultSizes.TryGetValue(tag, out var size))
                tmp.fontSize = size;
        }

        private static void AddButtonComponents(GameObject go)
        {
            var image = go.AddComponent<Image>();
            image.color = new Color(0, 0, 0, 0);
            image.raycastTarget = true;

            var button = go.AddComponent<UnityEngine.UI.Button>();
            button.transition = Selectable.Transition.None;
        }

        private static void AddInputComponents(GameObject go)
        {
            var image = go.AddComponent<Image>();
            image.color = Color.white;
            image.raycastTarget = true;

            // Create text area child
            var textArea = new GameObject("Text Area");
            textArea.AddComponent<RectTransform>();
            textArea.transform.SetParent(go.transform, false);
            var textAreaRT = textArea.GetComponent<RectTransform>();
            textAreaRT.anchorMin = Vector2.zero;
            textAreaRT.anchorMax = Vector2.one;
            textAreaRT.sizeDelta = Vector2.zero;

            // Create text child
            var textGo = new GameObject("Text");
            textGo.AddComponent<RectTransform>();
            textGo.transform.SetParent(textArea.transform, false);
            var tmp = textGo.AddComponent<TextMeshProUGUI>();
            tmp.fontSize = 14f;
            var textRT = textGo.GetComponent<RectTransform>();
            textRT.anchorMin = Vector2.zero;
            textRT.anchorMax = Vector2.one;
            textRT.sizeDelta = Vector2.zero;

            // Create placeholder child
            var placeholderGo = new GameObject("Placeholder");
            placeholderGo.AddComponent<RectTransform>();
            placeholderGo.transform.SetParent(textArea.transform, false);
            var placeholder = placeholderGo.AddComponent<TextMeshProUGUI>();
            placeholder.fontSize = 14f;
            placeholder.fontStyle = FontStyles.Italic;
            placeholder.color = new Color(0.5f, 0.5f, 0.5f, 0.5f);
            var phRT = placeholderGo.GetComponent<RectTransform>();
            phRT.anchorMin = Vector2.zero;
            phRT.anchorMax = Vector2.one;
            phRT.sizeDelta = Vector2.zero;

            var inputField = go.AddComponent<TMP_InputField>();
            inputField.textViewport = textAreaRT;
            inputField.textComponent = tmp;
            inputField.placeholder = placeholder;
        }

        private static void ApplyBackgroundColor(GameObject go, string value)
        {
            var color = CSSColorParser.Parse(value);
            var image = go.GetComponent<Image>();
            if (image == null)
                image = go.AddComponent<Image>();

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

        private static void ApplyTextColor(GameObject go, string value)
        {
            var color = CSSColorParser.Parse(value);
            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp == null)
            {
                var child = go.transform.Find("__WebiumText");
                if (child != null)
                    tmp = child.GetComponent<TextMeshProUGUI>();
            }
            if (tmp != null)
                tmp.color = color;
        }

        private static void ApplyFontSize(GameObject go, string value)
        {
            var px = CSSUnitParser.ParsePx(value);
            if (px <= 0f) return;

            var tmp = go.GetComponent<TextMeshProUGUI>();
            if (tmp == null)
            {
                var child = go.transform.Find("__WebiumText");
                if (child != null)
                    tmp = child.GetComponent<TextMeshProUGUI>();
            }
            if (tmp != null)
                tmp.fontSize = px;
        }

        private static void ApplyPadding(GameObject go, string value)
        {
            // TODO: Proper padding implementation (layout group or child offset)
            // v0.1.0: parse single value and store as metadata for future use
            var px = CSSUnitParser.ParsePx(value);
            // For now, no visual effect — padding is handled by Yoga layout on the JS side
        }

    }

    /// <summary>
    /// Deserializes a typed-array RenderCommandBuffer into RenderCommand structs.
    /// </summary>
    internal static class RenderCommandDeserializer
    {
        private const byte FIELD_TAG = 1 << 0;
        private const byte FIELD_PARENT_ID = 1 << 1;
        private const byte FIELD_SIBLING_INDEX = 1 << 2;
        private const byte FIELD_LAYOUT = 1 << 3;
        private const byte FIELD_STYLES = 1 << 4;
        private const byte FIELD_TEXT = 1 << 5;

        public static List<RenderCommand> Deserialize(ReadOnlySpan<byte> buffer)
        {
            var commands = new List<RenderCommand>();
            if (buffer.Length < 4) return commands;

            int offset = 0;
            uint count = BitConverter.ToUInt32(buffer.Slice(offset, 4));
            offset += 4;

            for (int i = 0; i < count && offset < buffer.Length; i++)
            {
                var cmd = new RenderCommand();
                cmd.Op = (RenderOp)buffer[offset++];
                cmd.NodeId = BitConverter.ToInt32(buffer.Slice(offset, 4));
                offset += 4;
                byte mask = buffer[offset++];

                if ((mask & FIELD_TAG) != 0)
                {
                    cmd.Tag = (NodeTag)buffer[offset++];
                }
                if ((mask & FIELD_PARENT_ID) != 0)
                {
                    cmd.ParentId = BitConverter.ToInt32(buffer.Slice(offset, 4));
                    offset += 4;
                }
                if ((mask & FIELD_SIBLING_INDEX) != 0)
                {
                    cmd.SiblingIndex = BitConverter.ToInt32(buffer.Slice(offset, 4));
                    offset += 4;
                }
                if ((mask & FIELD_LAYOUT) != 0)
                {
                    cmd.X = BitConverter.ToSingle(buffer.Slice(offset, 4)); offset += 4;
                    cmd.Y = BitConverter.ToSingle(buffer.Slice(offset, 4)); offset += 4;
                    cmd.Width = BitConverter.ToSingle(buffer.Slice(offset, 4)); offset += 4;
                    cmd.Height = BitConverter.ToSingle(buffer.Slice(offset, 4)); offset += 4;
                }
                if ((mask & FIELD_STYLES) != 0)
                {
                    ushort len = BitConverter.ToUInt16(buffer.Slice(offset, 2));
                    offset += 2;
                    var text = System.Text.Encoding.UTF8.GetString(buffer.Slice(offset, len));
                    offset += len;
                    cmd.Styles = new Dictionary<string, string>();
                    foreach (var pair in text.Split('\0'))
                    {
                        int eq = pair.IndexOf('=');
                        if (eq >= 0)
                            cmd.Styles[pair.Substring(0, eq)] = pair.Substring(eq + 1);
                    }
                }
                if ((mask & FIELD_TEXT) != 0)
                {
                    ushort len = BitConverter.ToUInt16(buffer.Slice(offset, 2));
                    offset += 2;
                    cmd.Text = System.Text.Encoding.UTF8.GetString(buffer.Slice(offset, len));
                    offset += len;
                }

                commands.Add(cmd);
            }

            return commands;
        }
    }

}
