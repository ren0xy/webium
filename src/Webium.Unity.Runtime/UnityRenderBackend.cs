using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Unity UGUI implementation of <see cref="IRenderBackend"/>.
    /// Wraps GameObjectBacking logic, casting <c>RenderHandle</c> to
    /// <c>GameObject</c> and <c>parentHandle</c> to <c>Transform</c>.
    /// Serves as the reference implementation for other engine backends.
    /// </summary>
    public class UnityRenderBackend : IRenderBackend
    {
        /// <inheritdoc />
        public object EnsureBacking(VirtualNode node, object parentHandle)
        {
            if (node.RenderHandle is GameObject existing)
                return existing;

            var go = new GameObject($"Webium_{node.Tag}_{node.Id}");
            go.AddComponent<RectTransform>();
            go.transform.SetParent((Transform)parentHandle, false);
            node.RenderHandle = go;
            return go;
        }

        /// <inheritdoc />
        public void DestroyBacking(VirtualNode node)
        {
            if (node.RenderHandle is GameObject go)
            {
                Object.Destroy(go);
                node.RenderHandle = null;
            }
        }

        /// <inheritdoc />
        public void ReparentBacking(VirtualNode node, object newParentHandle, int siblingIndex)
        {
            if (node.RenderHandle is GameObject go)
            {
                go.transform.SetParent((Transform)newParentHandle, false);
                go.transform.SetSiblingIndex(siblingIndex);
            }
        }
    }
}
