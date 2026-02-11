using System.Collections.Generic;

namespace Webium.Core
{
    /// <summary>
    /// Lightweight read-only snapshot of a node's state for editor/debugging tools.
    /// Replaces direct VirtualNode references now that the DOM lives in JS.
    /// </summary>
    public class NodeSnapshot
    {
        public int Id { get; set; }
        public NodeTag Tag { get; set; }
        public string TextContent { get; set; }
        public object RenderHandle { get; set; }
        public Dictionary<string, string> Attributes { get; set; } = new Dictionary<string, string>();
        public List<NodeSnapshot> Children { get; set; } = new List<NodeSnapshot>();
    }
}
