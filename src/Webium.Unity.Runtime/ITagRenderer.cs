using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Interface for tag-specific renderers that synchronize
    /// a <see cref="VirtualNode"/> to its Unity backing components.
    /// </summary>
    public interface ITagRenderer
    {
        void Sync(VirtualNode node);
    }
}
