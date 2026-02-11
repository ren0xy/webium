namespace Webium.JSRuntime
{
    /// <summary>
    /// Minimal JSON array serializer for crossing the WASM boundary.
    /// Extracted from BrowserRuntime so it can be tested without UNITY_WEBGL.
    /// </summary>
    internal static class ArgSerializer
    {
        /// <summary>
        /// Serializes an array of arguments as a JSON array string.
        /// null → <c>null</c>, string → escaped JSON string, other → ToString().
        /// Null or empty input → <c>"[]"</c>.
        /// </summary>
        public static string SerializeArgs(object[] args)
        {
            if (args == null || args.Length == 0)
                return "[]";

            var parts = new string[args.Length];
            for (int i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg == null)
                    parts[i] = "null";
                else if (arg is string s)
                    parts[i] = "\"" + EscapeJsonString(s) + "\"";
                else
                    parts[i] = arg.ToString();
            }
            return "[" + string.Join(",", parts) + "]";
        }

        private static string EscapeJsonString(string s)
        {
            var sb = new System.Text.StringBuilder(s.Length);
            foreach (var c in s)
            {
                switch (c)
                {
                    case '\\': sb.Append("\\\\"); break;
                    case '"': sb.Append("\\\""); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    default:
                        if (c < ' ')
                            sb.AppendFormat("\\u{0:x4}", (int)c);
                        else
                            sb.Append(c);
                        break;
                }
            }
            return sb.ToString();
        }

    }
}
