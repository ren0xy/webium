using UnityEngine;

namespace Webium.Unity
{
    /// <summary>
    /// Tracks the currently loaded texture source and loading state
    /// for an <see cref="ImageRenderer"/>-managed node.
    /// </summary>
    public class ImageSourceTracker : MonoBehaviour
    {
        public string LoadedSrc;
        public bool IsLoading;
    }
}
