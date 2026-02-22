import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { ManifestParser, type ModManifest } from "../../src/modding/manifest-parser.js";

describe("ManifestParser", () => {
  const parser = new ManifestParser();

  it("parses a complete manifest", () => {
    const json = JSON.stringify({
      id: "test-mod", name: "Test", version: "1.0.0", entry: "main.js",
      description: "A test mod", author: "Dev", dependencies: ["dep1"],
      html: "<div></div>", css: ["style.css"],
    });
    const m = parser.parse(json);
    expect(m.id).toBe("test-mod");
    expect(m.name).toBe("Test");
    expect(m.version).toBe("1.0.0");
    expect(m.entry).toBe("main.js");
    expect(m.description).toBe("A test mod");
    expect(m.author).toBe("Dev");
    expect(m.dependencies).toEqual(["dep1"]);
    expect(m.html).toBe("<div></div>");
    expect(m.css).toEqual(["style.css"]);
  });

  it("returns null fields for empty string", () => {
    const m = parser.parse("");
    expect(m.id).toBeNull();
  });

  it("returns null fields for malformed JSON", () => {
    const m = parser.parse("{{{bad");
    expect(m.id).toBeNull();
  });

  it("returns null fields for non-object JSON", () => {
    const m = parser.parse('"just a string"');
    expect(m.id).toBeNull();
  });

  it("serializes and omits null fields", () => {
    const m: ModManifest = { id: "test", name: null, version: null, entry: null };
    const json = parser.serialize(m);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe("test");
    expect(parsed.name).toBeUndefined();
  });

  it("serializes arrays correctly", () => {
    const m: ModManifest = {
      id: "test", name: null, version: null, entry: null,
      dependencies: ["a", "b"], css: ["x.css"],
    };
    const json = parser.serialize(m);
    const parsed = JSON.parse(json);
    expect(parsed.dependencies).toEqual(["a", "b"]);
    expect(parsed.css).toEqual(["x.css"]);
  });
});

// Feature: js-core-migration, Property 21: ManifestParser round-trip
describe("Property 21: ManifestParser round-trip", () => {
  const parser = new ManifestParser();

  const arbManifest: fc.Arbitrary<ModManifest> = fc.record({
    id: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    version: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
    entry: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    author: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    dependencies: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }), { nil: null }),
    html: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
    css: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }), { nil: null }),
  });

  it("parse(serialize(manifest)) produces equivalent manifest", () => {
    fc.assert(
      fc.property(arbManifest, (manifest) => {
        const serialized = parser.serialize(manifest);
        const reparsed = parser.parse(serialized);

        expect(reparsed.id).toBe(manifest.id);
        expect(reparsed.name).toBe(manifest.name);
        expect(reparsed.version).toBe(manifest.version);
        expect(reparsed.entry).toBe(manifest.entry);
        expect(reparsed.description ?? null).toBe(manifest.description ?? null);
        expect(reparsed.author ?? null).toBe(manifest.author ?? null);
        expect(reparsed.html ?? null).toBe(manifest.html ?? null);

        if (manifest.dependencies) {
          expect(reparsed.dependencies).toEqual(manifest.dependencies);
        } else {
          expect(reparsed.dependencies ?? null).toBeNull();
        }
        if (manifest.css) {
          expect(reparsed.css).toEqual(manifest.css);
        } else {
          expect(reparsed.css ?? null).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });
});
