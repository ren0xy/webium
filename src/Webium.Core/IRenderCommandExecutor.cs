using System;

namespace Webium.Core
{
    /// <summary>
    /// Receives a serialized RenderCommandBuffer from JS_Core and translates
    /// each command to engine-native operations.
    /// </summary>
    public interface IRenderCommandExecutor
    {
        /// <summary>
        /// Executes the render commands contained in the serialized buffer.
        /// </summary>
        /// <param name="commandBuffer">
        /// The typed-array serialized RenderCommandBuffer from JS_Core.
        /// </param>
        void Execute(ReadOnlySpan<byte> commandBuffer);
    }
}
