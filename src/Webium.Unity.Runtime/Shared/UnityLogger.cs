using System;
using UnityEngine;
using Webium.Core;

namespace Webium.Unity
{
    /// <summary>
    /// Unity implementation of <see cref="ILogger"/>.
    /// Delegates to <c>Debug.LogWarning</c> and <c>Debug.LogException</c>.
    /// </summary>
    public class UnityLogger : Webium.Core.ILogger
    {
        public void LogWarning(string message) => Debug.LogWarning(message);

        public void LogException(Exception exception) => Debug.LogException(exception);
    }
}
