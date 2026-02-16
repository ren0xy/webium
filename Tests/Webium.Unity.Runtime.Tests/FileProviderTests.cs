using System.IO;
using System.Text;
using NUnit.Framework;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime
{
    /// <summary>
    /// Unit tests for FileProvider.
    /// Requirements: 2.1, 2.2, 2.3
    /// </summary>
    [TestFixture]
    public class FileProviderTests
    {
        private string _tempDir;

        [SetUp]
        public void SetUp()
        {
            _tempDir = Path.Combine(Path.GetTempPath(), "FileProviderTests_" + Path.GetRandomFileName());
            Directory.CreateDirectory(_tempDir);
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_tempDir))
                Directory.Delete(_tempDir, true);
        }

        // ── Relative path resolution (Req 2.1) ──

        [Test]
        public void ReadFile_RelativePath_ReturnsContent()
        {
            File.WriteAllText(Path.Combine(_tempDir, "hello.txt"), "world", Encoding.UTF8);

            var result = FileProvider.ReadFile(_tempDir, "hello.txt");

            Assert.AreEqual("world", result);
        }

        [Test]
        public void ReadFile_SubdirectoryPath_ReturnsContent()
        {
            var sub = Path.Combine(_tempDir, "sub");
            Directory.CreateDirectory(sub);
            File.WriteAllText(Path.Combine(sub, "nested.txt"), "deep", Encoding.UTF8);

            var result = FileProvider.ReadFile(_tempDir, "sub/nested.txt");

            Assert.AreEqual("deep", result);
        }

        // ── ./ prefix stripping (Req 2.1) ──

        [Test]
        public void ReadFile_DotSlashPrefix_StrippedAndResolved()
        {
            File.WriteAllText(Path.Combine(_tempDir, "style.css"), "body{}", Encoding.UTF8);

            var result = FileProvider.ReadFile(_tempDir, "./style.css");

            Assert.AreEqual("body{}", result);
        }

        // ── Missing file returns null (Req 2.3) ──

        [Test]
        public void ReadFile_MissingFile_ReturnsNull()
        {
            var result = FileProvider.ReadFile(_tempDir, "does-not-exist.txt");

            Assert.IsNull(result);
        }

        // ── Path traversal returns null (Req 2.1, security) ──

        [Test]
        public void ReadFile_PathTraversal_ReturnsNull()
        {
            // Create a file outside the base directory
            var parent = Directory.GetParent(_tempDir)!.FullName;
            File.WriteAllText(Path.Combine(parent, "secret.txt"), "nope", Encoding.UTF8);

            var result = FileProvider.ReadFile(_tempDir, "../secret.txt");

            Assert.IsNull(result);

            // Cleanup
            File.Delete(Path.Combine(parent, "secret.txt"));
        }

        [Test]
        public void ReadFile_NestedPathTraversal_ReturnsNull()
        {
            var result = FileProvider.ReadFile(_tempDir, "sub/../../etc/passwd");

            Assert.IsNull(result);
        }

        // ── UTF-8 round-trip (Req 2.2) ──

        [Test]
        public void ReadFile_Utf8Content_RoundTrips()
        {
            var content = "Héllo Wörld — 日本語テスト 🎉";
            File.WriteAllText(Path.Combine(_tempDir, "utf8.txt"), content, Encoding.UTF8);

            var result = FileProvider.ReadFile(_tempDir, "utf8.txt");

            Assert.AreEqual(content, result);
        }

        [Test]
        public void ReadFile_EmptyFile_ReturnsEmptyString()
        {
            File.WriteAllText(Path.Combine(_tempDir, "empty.txt"), "", Encoding.UTF8);

            var result = FileProvider.ReadFile(_tempDir, "empty.txt");

            Assert.AreEqual("", result);
        }
    }
}
