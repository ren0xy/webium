using UnityEngine;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Startup orchestrator that reads a UI folder, initializes the JS runtime,
    /// parses HTML, loads CSS, executes scripts, runs the first reconciliation
    /// tick, and enables the frame loop. Requires WebiumSurface on the same GameObject.
    /// </summary>
    [RequireComponent(typeof(WebiumSurface))]
    [AddComponentMenu("Webium/Webium Bootstrapper")]
    public class WebiumBootstrapper : MonoBehaviour
    {
        [SerializeField] private string _uiFolderPath = "examples/hello-world";

        private WebiumSurface _surface;

        private void Start()
        {
            _surface = GetComponent<WebiumSurface>();
            var runtime = _surface.Runtime;
            var bridge = _surface.Bridge;
            var executor = _surface.Executor;

            // Resolve UI folder path relative to package location
            var resolvedPath = ResolveUIFolderPath();

            // 1. Read index.html from the resolved UI folder
            var htmlPath = System.IO.Path.Combine(resolvedPath, "index.html");
            var html = System.IO.File.ReadAllText(htmlPath, System.Text.Encoding.UTF8);

            // 2. Wire console.log/warn/error → Unity Debug.Log (before any JS runs)
            runtime.RegisterBinding("__webium_log", new System.Action<string>(
                msg => Debug.Log("[Webium JS] " + msg)
            ));
            runtime.RegisterBinding("__webium_warn", new System.Action<string>(
                msg => Debug.LogWarning("[Webium JS] " + msg)
            ));
            runtime.RegisterBinding("__webium_error", new System.Action<string>(
                msg => Debug.LogError("[Webium JS] " + msg)
            ));
            runtime.Evaluate(@"
                (function() {
                    var log = globalThis.__webium_log;
                    var warn = globalThis.__webium_warn;
                    var error = globalThis.__webium_error;
                    function stringify() {
                        var parts = [];
                        for (var i = 0; i < arguments.length; i++) {
                            var a = arguments[i];
                            parts.push(typeof a === 'object' ? JSON.stringify(a) : String(a));
                        }
                        return parts.join(' ');
                    }
                    globalThis.console = {
                        log: function() { log(stringify.apply(null, arguments)); },
                        warn: function() { warn(stringify.apply(null, arguments)); },
                        error: function() { error(stringify.apply(null, arguments)); },
                        info: function() { log(stringify.apply(null, arguments)); },
                        debug: function() { log(stringify.apply(null, arguments)); }
                    };
                })();
            ");

            // 3. Evaluate @webium/core bootstrap script
            runtime.Evaluate(GetBootstrapScript());

            // 4. Register FileProvider binding so JS can read files from the UI folder
            runtime.RegisterBinding("readFile", new System.Func<string, string>(
                path => FileProvider.ReadFile(resolvedPath, path)
            ));

            // 5. Initialize: parse HTML, load CSS, setup document API, execute scripts
            Debug.Log($"[Webium] Initializing with UI folder: {resolvedPath}");
            runtime.CallFunction("initialize", html);

            // 6. First reconciliation tick
            var buffer = bridge.CallTick();
            Debug.Log($"[Webium] First tick returned {buffer?.Length ?? 0} bytes");

            // 7. Execute initial render commands
            if (buffer != null && buffer.Length > 0)
                executor.Execute(buffer);

            // 8. Enable the frame loop for subsequent ticks
            _surface.EnableLoop();
        }

        private string GetBootstrapScript()
        {
            return Resources.Load<TextAsset>("webium-bootstrap").text;
        }

        /// <summary>
        /// Resolves <see cref="_uiFolderPath"/> to an absolute directory path using a
        /// multi-strategy approach: (1) absolute paths pass through, (2) try relative
        /// to Application.dataPath, (3) try relative to the Webium package root found
        /// via stack trace, (4) fallback to the original value.
        /// </summary>
        private string ResolveUIFolderPath()
        {
            if (System.IO.Path.IsPathRooted(_uiFolderPath))
                return _uiFolderPath;

            // Try relative to Application.dataPath (Assets folder)
            var fromDataPath = System.IO.Path.Combine(
                Application.dataPath, _uiFolderPath);
            if (System.IO.Directory.Exists(fromDataPath))
                return fromDataPath;

            // Try relative to the Webium package root (found via script location)
            var packageRoot = GetWebiumPackageRoot();
            if (packageRoot != null)
            {
                var fromPackage = System.IO.Path.Combine(packageRoot, _uiFolderPath);
                if (System.IO.Directory.Exists(fromPackage))
                    return fromPackage;
            }

            // Fallback: return as-is (original behavior)
            return _uiFolderPath;
        }

        /// <summary>
        /// Walks up from the current script's file location to find the Webium package
        /// root directory (identified by containing an <c>examples/</c> folder).
        /// Works for both Assets/ subfolders and Packages/ UPM installs.
        /// </summary>
        private static string GetWebiumPackageRoot()
        {
            var thisScript = new System.Diagnostics.StackTrace(true).GetFrame(0)?.GetFileName();
            if (thisScript == null)
                return null;

            var dir = System.IO.Path.GetDirectoryName(thisScript);
            while (dir != null)
            {
                if (System.IO.Directory.Exists(System.IO.Path.Combine(dir, "examples")))
                    return dir;
                dir = System.IO.Path.GetDirectoryName(dir);
            }

            return null;
        }

    }
}
