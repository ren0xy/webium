using Facebook.Yoga;
using UnityEngine;
using Webium.Core;
using Webium.Layout;

namespace Webium.Unity
{
    /// <summary>
    /// Reads computed layout values from Yoga nodes and writes them
    /// to Unity RectTransform components on each node's backing GameObject.
    /// Casts <c>node.RenderHandle</c> to <c>GameObject</c> to obtain the
    /// <c>RectTransform</c>, keeping the core layer engine-agnostic.
    /// </summary>
    public class RectTransformSync
    {
        /// <summary>
        /// Configures a RectTransform with top-left anchoring to match Yoga's
        /// coordinate system. Sets anchors to (0,1), pivot to (0,1),
        /// anchoredPosition to (left, -top), sizeDelta to (width, height).
        /// </summary>
        internal static void ApplyToRectTransform(
            RectTransform rt,
            float left, float top,
            float width, float height)
        {
            if (rt == null) return;

            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.anchoredPosition = new Vector2(left, -top);
            rt.sizeDelta = new Vector2(width, height);
        }

        /// <summary>
        /// Walks the VirtualNode tree depth-first. For each node whose
        /// <c>RenderHandle</c> is a <c>GameObject</c> with a <c>RectTransform</c>,
        /// reads computed layout values from the corresponding YogaNode and applies them.
        /// </summary>
        public void ApplyLayout(VirtualNode root, YogaTreeManager treeManager)
        {
            if (root == null || treeManager == null) return;
            ApplyLayoutRecursive(root, treeManager);
        }

        private void ApplyLayoutRecursive(VirtualNode node, YogaTreeManager treeManager)
        {
            var yogaNode = treeManager.GetYogaNode(node);
            if (yogaNode != null && node.RenderHandle is GameObject go)
            {
                var rt = go.GetComponent<RectTransform>();
                if (rt != null)
                {
                    ApplyToRectTransform(
                        rt,
                        yogaNode.LayoutX,
                        yogaNode.LayoutY,
                        yogaNode.LayoutWidth,
                        yogaNode.LayoutHeight);
                }
            }

            for (int i = 0; i < node.Children.Count; i++)
                ApplyLayoutRecursive(node.Children[i], treeManager);
        }
    }
}
