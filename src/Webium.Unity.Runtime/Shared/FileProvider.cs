using System.IO;
using System.Text;

namespace Webium.Unity
{
    /// <summary>
    /// Static utility that resolves relative paths against a base folder
    /// and reads files as UTF-8 strings. Returns null for missing files
    /// or path traversal attempts.
    /// </summary>
    public static class FileProvider
    {
        /// <summary>
        /// Reads a file relative to the base folder path.
        /// Returns null if the file does not exist or the resolved path
        /// escapes the base directory.
        /// </summary>
        public static string ReadFile(string basePath, string relativePath)
        {
            // Normalize path separators
            var normalized = relativePath.Replace('/', Path.DirectorySeparatorChar);
            if (normalized.StartsWith("." + Path.DirectorySeparatorChar))
                normalized = normalized.Substring(2);

            var fullPath = Path.Combine(basePath, normalized);
            var resolvedPath = Path.GetFullPath(fullPath);

            // Security: ensure resolved path is within basePath
            var resolvedBase = Path.GetFullPath(basePath);
            if (!resolvedPath.StartsWith(resolvedBase))
                return null;

            if (!File.Exists(resolvedPath))
                return null;

            return File.ReadAllText(resolvedPath, Encoding.UTF8);
        }
    }
}
