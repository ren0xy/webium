using Webium.Core;

namespace Webium.Editor
{
    public static class NodeDetailFormatter
    {
        public static string FormatRenderHandle(NodeSnapshot node)
        {
            if (node == null || node.RenderHandle == null)
                return "null";

            var handle = node.RenderHandle;
            return $"{handle.GetType().Name} \"{handle}\"";
        }
    }
}
