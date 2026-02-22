using System;
using System.Collections.Generic;
using UnityEngine;
using TMPro;

namespace Webium.Unity
{
    /// <summary>
    /// Resolves CSS <c>font-family</c> values to Unity font assets.
    /// Supports comma-separated fallback lists, optional quotes,
    /// generic family keywords, and runtime-registered custom mappings.
    /// Falls back to the default font when nothing matches.
    /// </summary>
    public static class CSSFontFamilyResolver
    {
        private static readonly Dictionary<string, string> GenericTMPFamilies =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "sans-serif", "LiberationSans SDF" },
                { "serif", "LiberationSerif SDF" },
                { "monospace", "LiberationMono SDF" },
                { "cursive", "LiberationSans SDF" },
                { "fantasy", "LiberationSans SDF" }
            };

        private static readonly Dictionary<string, string> GenericFontFamilies =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "sans-serif", "LiberationSans" },
                { "serif", "LiberationSerif" },
                { "monospace", "LiberationMono" },
                { "cursive", "LiberationSans" },
                { "fantasy", "LiberationSans" }
            };

        /// <summary>
        /// Maps generic CSS families to actual OS font names for
        /// <see cref="Font.CreateDynamicFontFromOSFont"/> fallback.
        /// </summary>
        private static readonly Dictionary<string, string> GenericOSFontFallbacks =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                { "sans-serif", "Arial" },
                { "serif", "Times New Roman" },
                { "monospace", "Courier New" },
                { "cursive", "Comic Sans MS" },
                { "fantasy", "Impact" }
            };

        private static readonly Dictionary<string, TMP_FontAsset> RegisteredTMP =
            new Dictionary<string, TMP_FontAsset>(StringComparer.OrdinalIgnoreCase);

        private static readonly Dictionary<string, Font> RegisteredFonts =
            new Dictionary<string, Font>(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Registers a TMP font asset and/or a Font for a given family name.
        /// Registered fonts take priority over <c>Resources.Load</c> lookups.
        /// </summary>
        public static void Register(string familyName, TMP_FontAsset tmpFont = null, Font font = null)
        {
            if (string.IsNullOrWhiteSpace(familyName)) return;

            familyName = familyName.Trim();
            if (tmpFont != null)
                RegisteredTMP[familyName] = tmpFont;
            if (font != null)
                RegisteredFonts[familyName] = font;
        }

        /// <summary>
        /// Resolves a CSS <c>font-family</c> string to a <see cref="TMP_FontAsset"/>.
        /// Returns the default TMP font (LiberationSans SDF) when nothing matches.
        /// </summary>
        public static TMP_FontAsset ResolveTMP(string fontFamily)
        {
            if (string.IsNullOrWhiteSpace(fontFamily))
                return LoadDefaultTMP();

            foreach (var name in ParseFamilyList(fontFamily))
            {
                // 1. Check runtime-registered mappings
                if (RegisteredTMP.TryGetValue(name, out var registered) && registered != null)
                    return registered;

                // 2. Check generic family keywords
                if (GenericTMPFamilies.TryGetValue(name, out var genericAssetName))
                {
                    var asset = Resources.Load<TMP_FontAsset>(genericAssetName);
                    if (asset != null) return asset;
                }

                // 3. Try Resources.Load with the raw name
                var loaded = Resources.Load<TMP_FontAsset>(name);
                if (loaded != null) return loaded;
            }

            return LoadDefaultTMP();
        }

        /// <summary>
        /// Resolves a CSS <c>font-family</c> string to a <see cref="Font"/>.
        /// Returns the default Font (LiberationSans) when nothing matches.
        /// </summary>
        public static Font ResolveFont(string fontFamily)
        {
            if (string.IsNullOrWhiteSpace(fontFamily))
                return LoadDefaultFont();

            foreach (var name in ParseFamilyList(fontFamily))
            {
                // 1. Check runtime-registered mappings
                if (RegisteredFonts.TryGetValue(name, out var registered) && registered != null)
                {
                    return registered;
                }

                // 2. Check generic family keywords
                if (GenericFontFamilies.TryGetValue(name, out var genericFontName))
                {
                    // 2a. Try Resources.Load with the Liberation font name
                    var font = Resources.Load<Font>(genericFontName);
                    if (font != null)
                    {
                        return font;
                    }
                    // 2b. Try OS font fallback (Arial, Times New Roman, etc.)
                    if (GenericOSFontFallbacks.TryGetValue(name, out var osFontName))
                    {
                        font = Font.CreateDynamicFontFromOSFont(osFontName, 16);
                        if (font != null)
                        {
                            return font;
                        }
                    }
                }

                // 3. Try Resources.Load with the raw name
                var loaded = Resources.Load<Font>(name);
                if (loaded != null)
                {
                    return loaded;
                }
            }

            UnityEngine.Debug.LogWarning($"[Webium] Font fallback to default for '{fontFamily}'");
            return LoadDefaultFont();
        }

        /// <summary>
        /// Parses a CSS font-family value into individual family names.
        /// Handles comma-separated lists and optional single/double quotes.
        /// </summary>
        internal static List<string> ParseFamilyList(string fontFamily)
        {
            var result = new List<string>();
            if (string.IsNullOrWhiteSpace(fontFamily))
                return result;

            var parts = fontFamily.Split(',');
            for (int i = 0; i < parts.Length; i++)
            {
                var name = parts[i].Trim();
                // Strip surrounding quotes (single or double)
                if (name.Length >= 2 &&
                    ((name[0] == '"' && name[name.Length - 1] == '"') ||
                     (name[0] == '\'' && name[name.Length - 1] == '\'')))
                {
                    name = name.Substring(1, name.Length - 2).Trim();
                }

                if (!string.IsNullOrEmpty(name))
                    result.Add(name);
            }

            return result;
        }

        private static TMP_FontAsset LoadDefaultTMP()
        {
            // Try loading the standard TMP default font
            var asset = Resources.Load<TMP_FontAsset>("LiberationSans SDF");
            if (asset != null) return asset;

            // Fallback: use TMP_Settings default if available
            if (TMP_Settings.defaultFontAsset != null)
                return TMP_Settings.defaultFontAsset;

            return null;
        }

        private static Font LoadDefaultFont()
        {
            var font = Resources.Load<Font>("LiberationSans");
            if (font != null)
            {
                return font;
            }

            // Fallback: use Arial which is typically available in Unity
            var arial = Resources.GetBuiltinResource<Font>("Arial.ttf");
            return arial;
        }
    }
}
