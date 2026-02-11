using System.Collections.Generic;

namespace Webium.Core
{
    /// <summary>
    /// A deserialized render command from the JS-side RenderCommandBuffer.
    /// </summary>
    public struct RenderCommand
    {
        public RenderOp Op;
        public int NodeId;
        public NodeTag? Tag;
        public int? ParentId;
        public int? SiblingIndex;
        public float? X;
        public float? Y;
        public float? Width;
        public float? Height;
        public Dictionary<string, string> Styles;
        public string Text;
    }
}
