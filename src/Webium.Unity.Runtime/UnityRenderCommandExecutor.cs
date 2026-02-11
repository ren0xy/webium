using System;
using System.Collections.Generic;
using UnityEngine;
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
        private readonly ITagRenderer[] _tagRenderers;

        public UnityRenderCommandExecutor(Transform rootTransform, ITagRenderer[] tagRenderers)
        {
            _rootTransform = rootTransform;
            _tagRenderers = tagRenderers ?? Array.Empty<ITagRenderer>();
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

            _nodeObjects[cmd.NodeId] = go;
        }

        private void ExecuteDestroy(RenderCommand cmd)
        {
            if (_nodeObjects.TryGetValue(cmd.NodeId, out var go))
            {
                UnityEngine.Object.Destroy(go);
                _nodeObjects.Remove(cmd.NodeId);
            }
        }

        private void ExecuteUpdateLayout(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;
            var rt = go.GetComponent<RectTransform>();
            if (rt == null) return;

            rt.anchoredPosition = new Vector2(cmd.X ?? 0, -(cmd.Y ?? 0));
            rt.sizeDelta = new Vector2(cmd.Width ?? 0, cmd.Height ?? 0);
        }

        private void ExecuteUpdateStyle(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;
            if (cmd.Styles == null) return;

            foreach (var renderer in _tagRenderers)
            {
                renderer.ApplyStyles(go, cmd.Styles);
            }
        }

        private void ExecuteUpdateText(RenderCommand cmd)
        {
            if (!_nodeObjects.TryGetValue(cmd.NodeId, out var go)) return;

            foreach (var renderer in _tagRenderers)
            {
                renderer.ApplyText(go, cmd.Text ?? string.Empty);
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

    /// <summary>
    /// Interface for tag-specific renderers that apply styles and text.
    /// </summary>
    public interface ITagRenderer
    {
        void ApplyStyles(GameObject go, Dictionary<string, string> styles);
        void ApplyText(GameObject go, string text);
    }
}
