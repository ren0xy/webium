using UnityEngine;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Thin Unity MonoBehaviour wrapper that implements ILifecycleDriver.
    /// Calls JS-side tick() via the bridge in LateUpdate, receives the
    /// RenderCommandBuffer, and feeds it to the UnityRenderCommandExecutor.
    /// </summary>
    public class ReconciliationLoopBehaviour : MonoBehaviour, ILifecycleDriver
    {
        private IJSBridge _bridge;
        private IRenderCommandExecutor _executor;

        [System.Obsolete("Use Initialize(IJSBridge, IRenderCommandExecutor) instead.")]
        private ReconciliationEngine _legacyEngine;

        /// <summary>
        /// Initializes with the new architecture: bridge + command executor.
        /// </summary>
        public void Initialize(IJSBridge bridge, IRenderCommandExecutor executor)
        {
            _bridge = bridge;
            _executor = executor;
        }

        /// <summary>
        /// Legacy initializer for backward compatibility during migration.
        /// </summary>
        [System.Obsolete("Use Initialize(IJSBridge, IRenderCommandExecutor) instead.")]
        public void Initialize(ReconciliationEngine engine)
        {
            _legacyEngine = engine;
        }

        public void Tick()
        {
            if (_bridge != null && _executor != null)
            {
                var buffer = _bridge.CallTick();
                if (buffer != null && buffer.Length > 0)
                {
                    _executor.Execute(buffer);
                }
            }
        }

        private void LateUpdate()
        {
            Tick();
        }
    }
}
