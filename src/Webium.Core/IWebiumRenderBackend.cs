using System;

namespace Webium.Core
{
    /// <summary>
    /// Bundles all backend-specific concerns for a Webium render backend:
    /// command execution, input forwarding, layout readback, and teardown.
    /// </summary>
    public interface IWebiumRenderBackend : IDisposable
    {
        /// <summary>The render command executor for this backend.</summary>
        IRenderCommandExecutor Executor { get; }

        /// <summary>The input event forwarder for this backend.</summary>
        IInputEventForwarder InputForwarder { get; }

        /// <summary>The layout readback bridge for this backend.</summary>
        ILayoutReadbackNew LayoutBridge { get; }

        /// <summary>The text measurer for this backend.</summary>
        ITextMeasurer TextMeasurer { get; }
    }
}
