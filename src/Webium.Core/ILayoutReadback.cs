using System;
using System.Collections.Generic;

namespace Webium.Core
{
    /// <summary>
    /// Legacy layout readback interface. Use <see cref="ILayoutReadbackNew"/> instead.
    /// Kept for transition period only.
    /// </summary>
    [Obsolete("Use ILayoutReadbackNew with nodeId-based queries instead.")]
    public interface ILayoutReadback
    {
        (float X, float Y, float Width, float Height) GetBoundingClientRect(int nodeId);
        float GetOffsetWidth(int nodeId);
        float GetOffsetHeight(int nodeId);
        IReadOnlyDictionary<string, string> GetComputedStyle(int nodeId);
        void EnsureLayoutUpToDate(int nodeId);
    }
}
