namespace Webium.Core
{
    /// <summary>
    /// Measures text dimensions using the backend's font engine.
    /// </summary>
    public interface ITextMeasurer
    {
        TextMeasurement Measure(string text, string fontFamily, float fontSize, string fontWeight, string fontStyle);
    }

    /// <summary>
    /// Pixel dimensions returned by <see cref="ITextMeasurer.Measure"/>.
    /// </summary>
    public struct TextMeasurement
    {
        public float Width;
        public float Height;
    }
}
