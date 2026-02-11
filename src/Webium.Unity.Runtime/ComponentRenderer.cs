using System;
using System.Collections.Generic;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Central dispatcher implementing <see cref="IComponentRenderer"/>.
    /// Routes dirty nodes to tag-specific <see cref="ITagRenderer"/> instances.
    /// </summary>
    public class ComponentRenderer : IComponentRenderer
    {
        private readonly Dictionary<NodeTag, ITagRenderer> _renderers;
        private readonly ILogger _logger;

        public ComponentRenderer(ILogger logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _renderers = new Dictionary<NodeTag, ITagRenderer>
            {
                { NodeTag.Div, new DivRenderer() },
                { NodeTag.Img, new ImageRenderer(logger) },
                { NodeTag.Span, new TextRenderer() },
                { NodeTag.P, new TextRenderer() },
                { NodeTag.Text, new TextRenderer() }
            };
        }

        public void RegisterRenderer(NodeTag tag, ITagRenderer renderer)
        {
            if (renderer == null)
                throw new ArgumentNullException(nameof(renderer));

            _renderers[tag] = renderer;
        }

        public void SyncVisuals(IReadOnlyList<VirtualNode> dirtyNodes)
        {
            if (dirtyNodes == null)
                throw new ArgumentNullException(nameof(dirtyNodes));

            for (int i = 0; i < dirtyNodes.Count; i++)
            {
                var node = dirtyNodes[i];

                if (node.RenderHandle == null)
                {
                    _logger.LogWarning($"[ComponentRenderer] Node {node.Id} has null RenderHandle, skipping.");
                    continue;
                }

                if (!_renderers.TryGetValue(node.Tag, out var renderer))
                {
                    _logger.LogWarning($"[ComponentRenderer] No renderer registered for tag {node.Tag}, skipping node {node.Id}.");
                    continue;
                }

                try
                {
                    renderer.Sync(node);
                }
                catch (Exception ex)
                {
                    _logger.LogException(ex);
                }
            }
        }
    }
}
