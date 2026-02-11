using System;

namespace Webium.Core
{
    /// <summary>
    /// Engine-agnostic logging abstraction for the Webium core layer.
    /// Each engine backend provides its own implementation
    /// (e.g. Unity wraps <c>Debug.LogWarning</c> / <c>Debug.LogException</c>,
    /// Godot wraps <c>GD.PrintErr</c>, headless tests use a console logger).
    /// </summary>
    public interface ILogger
    {
        /// <summary>
        /// Logs a non-fatal warning message.
        /// </summary>
        /// <param name="message">The warning text to log.</param>
        void LogWarning(string message);

        /// <summary>
        /// Logs an exception, preserving its stack trace.
        /// </summary>
        /// <param name="exception">The exception to log.</param>
        void LogException(Exception exception);
    }
}
