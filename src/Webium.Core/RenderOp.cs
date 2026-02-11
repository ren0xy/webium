namespace Webium.Core
{
    /// <summary>
    /// Render operation types matching the JS-side RenderOp enum.
    /// </summary>
    public enum RenderOp : byte
    {
        Create = 0,
        Destroy = 1,
        UpdateLayout = 2,
        UpdateStyle = 3,
        UpdateText = 4,
        Reparent = 5
    }
}
