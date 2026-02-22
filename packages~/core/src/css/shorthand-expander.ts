/**
 * Expands CSS shorthand properties into their longhand equivalents.
 *
 * Supported shorthands: `margin`, `padding`.
 * Designed to be extended with additional shorthands in the future.
 *
 * @see Requirements CPR-2, CPR-3
 */

type LonghandKeys = [top: string, right: string, bottom: string, left: string];

const SHORTHAND_MAP: ReadonlyMap<string, LonghandKeys> = new Map([
  ["margin", ["margin-top", "margin-right", "margin-bottom", "margin-left"]],
  ["padding", ["padding-top", "padding-right", "padding-bottom", "padding-left"]],
  ["border-width", ["border-top-width", "border-right-width", "border-bottom-width", "border-left-width"]],
]);

/**
 * Parses a 1/2/3/4-value CSS shorthand into [top, right, bottom, left].
 * Returns `undefined` when the value contains no valid parts.
 */
function parseFourSided(value: string): [string, string, string, string] | undefined {
  const parts = value.trim().split(/\s+/);
  switch (parts.length) {
    case 1:
      return [parts[0], parts[0], parts[0], parts[0]];
    case 2:
      return [parts[0], parts[1], parts[0], parts[1]];
    case 3:
      return [parts[0], parts[1], parts[2], parts[1]];
    case 4:
      return [parts[0], parts[1], parts[2], parts[3]];
    default:
      return undefined;
  }
}

export class CSSShorthandExpander {
  /**
   * Expands recognised shorthand properties in the given style map.
   *
   * - Shorthand keys are removed after expansion.
   * - Longhand properties already present in the map are preserved
   *   (explicit longhand overrides expanded shorthand).
   *
   * Returns a **new** map — the input is not mutated.
   */
  expand(styles: Map<string, string>): Map<string, string> {
    const result = new Map(styles);

    for (const [shorthand, longhands] of SHORTHAND_MAP) {
      const value = result.get(shorthand);
      if (value === undefined) continue;

      const parsed = parseFourSided(value);
      if (parsed === undefined) continue;

      // Remove the shorthand key
      result.delete(shorthand);

      // Set each longhand only if not already explicitly present
      for (let i = 0; i < 4; i++) {
        if (!styles.has(longhands[i])) {
          result.set(longhands[i], parsed[i]);
        }
      }
    }

    return result;
  }
}
