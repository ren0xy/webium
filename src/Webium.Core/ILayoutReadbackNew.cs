namespace Webium.Core
{
    /// <summary>
    /// Provides synchronous layout readback queries using nodeId instead of
    /// VirtualNode references. Used for JS queries like getBoundingClientRect.
    /// </summary>
    public interface ILayoutReadbackNew
    {
        /// <summary>Gets the X position of the node.</summary>
        float GetX(int nodeId);

        /// <summary>Gets the Y position of the node.</summary>
        float GetY(int nodeId);

        /// <summary>Gets the computed width of the node.</summary>
        float GetWidth(int nodeId);

        /// <summary>Gets the computed height of the node.</summary>
        float GetHeight(int nodeId);
    }
}
