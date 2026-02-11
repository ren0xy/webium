using System;

namespace Webium.Core
{
    /// <summary>
    /// Legacy render backend interface. Use <see cref="IRenderCommandExecutor"/> instead.
    /// Kept for transition period only.
    /// </summary>
    [Obsolete("Use IRenderCommandExecutor with render command consumption instead.")]
    public interface IRenderBackend
    {
        object EnsureBacking(int nodeId, object parentHandle);
        void DestroyBacking(int nodeId);
        void ReparentBacking(int nodeId, object newParentHandle, int siblingIndex);
    }
}
