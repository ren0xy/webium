using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Webium.Unity
{
    /// <summary>
    /// Parses CSS color values into Unity <see cref="Color"/>.
    /// Returns <see cref="Color.clear"/> for invalid or unrecognized inputs.
    /// </summary>
    public static class CSSColorParser
    {
        private static readonly Dictionary<string, Color> NamedColors = new Dictionary<string, Color>(StringComparer.OrdinalIgnoreCase)
        {
            { "transparent", Color.clear },
            { "white", Color.white },
            { "black", Color.black },
            { "red", Color.red },
            { "green", Color.green },
            { "blue", Color.blue },
            { "yellow", Color.yellow },
            { "cyan", Color.cyan },
            { "magenta", Color.magenta },
            { "gray", Color.gray },
            { "grey", Color.gray }
        };

        public static Color Parse(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return Color.clear;

            value = value.Trim();

            if (NamedColors.TryGetValue(value, out var named))
                return named;

            if (value.StartsWith("#"))
                return ParseHex(value);

            var lower = value.ToLowerInvariant();
            if (lower.StartsWith("rgba("))
                return ParseRgba(lower);
            if (lower.StartsWith("rgb("))
                return ParseRgb(lower);

            return Color.clear;
        }

        private static Color ParseHex(string hex)
        {
            try
            {
                hex = hex.Substring(1); // strip '#'
                switch (hex.Length)
                {
                    case 3: // #RGB
                    {
                        int r = Convert.ToInt32(new string(hex[0], 2), 16);
                        int g = Convert.ToInt32(new string(hex[1], 2), 16);
                        int b = Convert.ToInt32(new string(hex[2], 2), 16);
                        return new Color(r / 255f, g / 255f, b / 255f, 1f);
                    }
                    case 6: // #RRGGBB
                    {
                        int r = Convert.ToInt32(hex.Substring(0, 2), 16);
                        int g = Convert.ToInt32(hex.Substring(2, 2), 16);
                        int b = Convert.ToInt32(hex.Substring(4, 2), 16);
                        return new Color(r / 255f, g / 255f, b / 255f, 1f);
                    }
                    case 8: // #RRGGBBAA
                    {
                        int r = Convert.ToInt32(hex.Substring(0, 2), 16);
                        int g = Convert.ToInt32(hex.Substring(2, 2), 16);
                        int b = Convert.ToInt32(hex.Substring(4, 2), 16);
                        int a = Convert.ToInt32(hex.Substring(6, 2), 16);
                        return new Color(r / 255f, g / 255f, b / 255f, a / 255f);
                    }
                    default:
                        return Color.clear;
                }
            }
            catch
            {
                return Color.clear;
            }
        }

        private static Color ParseRgb(string value)
        {
            try
            {
                var inner = value.Substring(4, value.Length - 5); // strip "rgb(" and ")"
                var parts = inner.Split(',');
                if (parts.Length != 3) return Color.clear;

                int r = int.Parse(parts[0].Trim(), CultureInfo.InvariantCulture);
                int g = int.Parse(parts[1].Trim(), CultureInfo.InvariantCulture);
                int b = int.Parse(parts[2].Trim(), CultureInfo.InvariantCulture);
                return new Color(r / 255f, g / 255f, b / 255f, 1f);
            }
            catch
            {
                return Color.clear;
            }
        }

        private static Color ParseRgba(string value)
        {
            try
            {
                var inner = value.Substring(5, value.Length - 6); // strip "rgba(" and ")"
                var parts = inner.Split(',');
                if (parts.Length != 4) return Color.clear;

                int r = int.Parse(parts[0].Trim(), CultureInfo.InvariantCulture);
                int g = int.Parse(parts[1].Trim(), CultureInfo.InvariantCulture);
                int b = int.Parse(parts[2].Trim(), CultureInfo.InvariantCulture);
                float a = float.Parse(parts[3].Trim(), CultureInfo.InvariantCulture);
                return new Color(r / 255f, g / 255f, b / 255f, a);
            }
            catch
            {
                return Color.clear;
            }
        }
    }
}
