/**
 * CSS Style Inheritance module.
 *
 * Defines which CSS properties are inheritable, their initial values,
 * and provides the `applyInheritance()` method that resolves "inherit"
 * and "initial" keywords, inherits unset inheritable properties from
 * the parent computed style, and applies initial values for unset
 * non-inheritable properties.
 *
 * @see Requirements 3.5
 */

/** The set of CSS properties that are inherited by default. */
export const INHERITABLE_PROPERTIES: ReadonlySet<string> = new Set([
  "color",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "line-height",
  "text-align",
  "visibility",
  "cursor",
  "direction",
  "letter-spacing",
  "word-spacing",
  "white-space",
]);

/** Initial (default) values for all known CSS properties. */
export const INITIAL_VALUES: ReadonlyMap<string, string> = new Map([
  // Inheritable
  ["color", "black"],
  ["font-size", "medium"],
  ["font-family", "serif"],
  ["font-weight", "normal"],
  ["font-style", "normal"],
  ["line-height", "normal"],
  ["text-align", "start"],
  ["visibility", "visible"],
  ["cursor", "auto"],
  ["direction", "ltr"],
  ["letter-spacing", "normal"],
  ["word-spacing", "normal"],
  ["white-space", "normal"],
  // Non-inheritable
  ["display", "inline"],
  ["margin", "0"],
  ["margin-top", "0"],
  ["margin-right", "0"],
  ["margin-bottom", "0"],
  ["margin-left", "0"],
  ["padding", "0"],
  ["padding-top", "0"],
  ["padding-right", "0"],
  ["padding-bottom", "0"],
  ["padding-left", "0"],
  ["border-width", "medium"],
  ["background-color", "transparent"],
  ["width", "auto"],
  ["height", "auto"],
  ["opacity", "1"],
  ["overflow", "visible"],
  ["position", "static"],
]);

export interface IStyleInheritance {
  applyInheritance(
    cascadedStyle: ReadonlyMap<string, string>,
    parentComputedStyle: ReadonlyMap<string, string> | null,
  ): Map<string, string>;
}

export class StyleInheritance implements IStyleInheritance {
  /**
   * Produces a complete computed style by resolving keyword values and
   * filling in missing properties via inheritance or initial values.
   *
   * 1. For each property in cascadedStyle with value "inherit":
   *    replace with parent's value (or initial value if no parent).
   * 2. For each property in cascadedStyle with value "initial":
   *    replace with the initial value.
   * 3. For inheritable properties NOT in cascadedStyle:
   *    inherit from parent (or use initial value if no parent).
   * 4. For non-inheritable properties NOT in cascadedStyle:
   *    use initial value.
   */
  applyInheritance(
    cascadedStyle: ReadonlyMap<string, string>,
    parentComputedStyle: ReadonlyMap<string, string> | null,
  ): Map<string, string> {
    const computed = new Map<string, string>();

    // Step 1 & 2: Resolve explicit cascaded values
    for (const [prop, value] of cascadedStyle) {
      if (value === "inherit") {
        const parentValue = parentComputedStyle?.get(prop) ?? null;
        computed.set(prop, parentValue ?? INITIAL_VALUES.get(prop) ?? "");
      } else if (value === "initial") {
        computed.set(prop, INITIAL_VALUES.get(prop) ?? "");
      } else {
        computed.set(prop, value);
      }
    }

    // Step 3 & 4: Fill in missing properties from INITIAL_VALUES
    for (const [prop, initialValue] of INITIAL_VALUES) {
      if (computed.has(prop)) continue;

      if (INHERITABLE_PROPERTIES.has(prop)) {
        // Inherit from parent, fall back to initial
        const parentValue = parentComputedStyle?.get(prop) ?? null;
        computed.set(prop, parentValue ?? initialValue);
      } else {
        // Non-inheritable: always use initial value
        computed.set(prop, initialValue);
      }
    }

    return computed;
  }
}
