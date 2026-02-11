namespace Webium.Core
{
    /// <summary>
    /// Drives the JS_Core reconciliation tick from the engine's frame loop.
    /// </summary>
    public interface ILifecycleDriver
    {
        /// <summary>
        /// Calls JS-side tick() and feeds the resulting RenderCommandBuffer
        /// to the IRenderCommandExecutor.
        /// </summary>
        void Tick();
    }
}
