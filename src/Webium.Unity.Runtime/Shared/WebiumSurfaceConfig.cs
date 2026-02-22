using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Selects which render backend a <see cref="WebiumSurface"/> uses.
    /// Create via Assets → Create → Webium → Surface Config.
    /// </summary>
    [CreateAssetMenu(fileName = "WebiumSurfaceConfig", menuName = "Webium/Surface Config")]
    public class WebiumSurfaceConfig : ScriptableObject
    {
        public RenderBackendType backendType = RenderBackendType.UGUI;

        [Tooltip("Optional PanelSettings for UIElements backend. Must have a ThemeStyleSheet assigned.")]
        public UnityEngine.UIElements.PanelSettings uiElementsPanelSettings;
    }
}
