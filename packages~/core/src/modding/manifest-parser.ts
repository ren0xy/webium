/**
 * Mod manifest data type.
 * @see Requirements 11.1
 */
export interface ModManifest {
  id: string | null;
  name: string | null;
  version: string | null;
  entry: string | null;
  description?: string | null;
  author?: string | null;
  dependencies?: string[] | null;
  html?: string | null;
  css?: string[] | null;
}

/**
 * Parses mod manifest JSON into ModManifest objects and serializes back.
 * Handles malformed JSON gracefully (returns manifest with null fields).
 *
 * Ported from C# ManifestParser.cs
 * @see Requirements 11.1
 */
export interface IManifestParser {
  parse(json: string): ModManifest;
  serialize(manifest: ModManifest): string;
}

export class ManifestParser implements IManifestParser {
  parse(json: string): ModManifest {
    if (!json || !json.trim()) {
      return { id: null, name: null, version: null, entry: null };
    }

    try {
      const obj = JSON.parse(json);
      if (typeof obj !== "object" || obj === null) {
        return { id: null, name: null, version: null, entry: null };
      }

      return {
        id: typeof obj.id === "string" ? obj.id : null,
        name: typeof obj.name === "string" ? obj.name : null,
        version: typeof obj.version === "string" ? obj.version : null,
        entry: typeof obj.entry === "string" ? obj.entry : null,
        description: typeof obj.description === "string" ? obj.description : null,
        author: typeof obj.author === "string" ? obj.author : null,
        dependencies: Array.isArray(obj.dependencies)
          ? obj.dependencies.filter((d: unknown) => typeof d === "string")
          : null,
        html: typeof obj.html === "string" ? obj.html : null,
        css: Array.isArray(obj.css)
          ? obj.css.filter((c: unknown) => typeof c === "string")
          : null,
      };
    } catch {
      return { id: null, name: null, version: null, entry: null };
    }
  }

  serialize(manifest: ModManifest): string {
    const obj: Record<string, unknown> = {};
    if (manifest.id !== null && manifest.id !== undefined) obj.id = manifest.id;
    if (manifest.name !== null && manifest.name !== undefined) obj.name = manifest.name;
    if (manifest.version !== null && manifest.version !== undefined) obj.version = manifest.version;
    if (manifest.entry !== null && manifest.entry !== undefined) obj.entry = manifest.entry;
    if (manifest.description !== null && manifest.description !== undefined) obj.description = manifest.description;
    if (manifest.author !== null && manifest.author !== undefined) obj.author = manifest.author;
    if (manifest.dependencies !== null && manifest.dependencies !== undefined) obj.dependencies = manifest.dependencies;
    if (manifest.html !== null && manifest.html !== undefined) obj.html = manifest.html;
    if (manifest.css !== null && manifest.css !== undefined) obj.css = manifest.css;
    return JSON.stringify(obj);
  }
}
