using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.UI;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Renders &lt;img&gt; elements by managing a <see cref="RawImage"/>
    /// component with async texture loading.
    /// </summary>
    public class ImageRenderer : ITagRenderer
    {
        private readonly ILogger _logger;

        public ImageRenderer() : this(null) { }

        public ImageRenderer(ILogger logger)
        {
            _logger = logger;
        }

        public void Sync(VirtualNode node)
        {
            if (node.Tag != NodeTag.Img)
                return;

            if ((node.Dirty & DirtyFlags.Attributes) == 0)
                return;

            var go = node.RenderHandle as GameObject;
            if (go == null)
                return;

            var rawImage = go.GetComponent<RawImage>();
            if (rawImage == null)
                rawImage = go.AddComponent<RawImage>();

            var tracker = go.GetComponent<ImageSourceTracker>();
            if (tracker == null)
                tracker = go.AddComponent<ImageSourceTracker>();

            node.Attributes.TryGetValue("src", out var src);

            if (string.IsNullOrEmpty(src))
            {
                rawImage.texture = null;
                tracker.LoadedSrc = null;
                tracker.IsLoading = false;
                return;
            }

            if (src == tracker.LoadedSrc || tracker.IsLoading)
                return;

            tracker.IsLoading = true;
            rawImage.texture = null; // placeholder: transparent while loading

            if (src.StartsWith("Resources/"))
            {
                var resourcePath = src.Substring("Resources/".Length);
                var request = Resources.LoadAsync<Texture2D>(resourcePath);
                request.completed += _ =>
                {
                    tracker.IsLoading = false;
                    if (request.asset is Texture2D tex)
                    {
                        rawImage.texture = tex;
                        tracker.LoadedSrc = src;
                    }
                    else
                    {
                        _logger?.LogWarning($"[ImageRenderer] Failed to load texture from Resources: {src}");
                    }
                };
            }
            else
            {
                LoadFromUri(src, rawImage, tracker);
            }
        }

        private void LoadFromUri(string uri, RawImage rawImage, ImageSourceTracker tracker)
        {
            var request = UnityWebRequestTexture.GetTexture(uri);
            var op = request.SendWebRequest();
            op.completed += _ =>
            {
                tracker.IsLoading = false;
                if (request.result == UnityWebRequest.Result.Success)
                {
                    var tex = DownloadHandlerTexture.GetContent(request);
                    rawImage.texture = tex;
                    tracker.LoadedSrc = uri;
                }
                else
                {
                    _logger?.LogWarning($"[ImageRenderer] Failed to load texture from URI: {uri} — {request.error}");
                }
                request.Dispose();
            };
        }
    }
}
