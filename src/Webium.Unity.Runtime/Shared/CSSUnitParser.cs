using System.Globalization;

namespace Webium.Unity
{
    /// <summary>
    /// Parses CSS numeric values with units into floats.
    /// Returns <c>0f</c> for invalid, null, or empty inputs.
    /// </summary>
    public static class CSSUnitParser
    {
        public static float ParsePx(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return 0f;

            value = value.Trim();

            if (value.EndsWith("px"))
                value = value.Substring(0, value.Length - 2);

            if (float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out float result))
                return result;

            return 0f;
        }
    }
}
