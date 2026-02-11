/**
 * Prefixes CSS selectors with a mod-specific attribute selector for isolation.
 * Handles @-rules (pass through), comma-separated selectors, and
 * already-scoped CSS (idempotent).
 *
 * Ported from C# CSSScoper.cs
 * @see Requirements 11.3, 11.4
 */
export interface ICSSScoper {
  scopeCSS(rawCSS: string, modId: string): string;
}

export class CSSScoper implements ICSSScoper {
  scopeCSS(rawCSS: string, modId: string): string {
    if (!rawCSS) return rawCSS ?? "";

    const prefix = `[data-mod-id="${modId}"] `;
    const prefixTrimmed = prefix.trimEnd();
    let result = "";
    let i = 0;

    while (i < rawCSS.length) {
      // Preserve whitespace
      while (i < rawCSS.length && /\s/.test(rawCSS[i])) {
        result += rawCSS[i];
        i++;
      }
      if (i >= rawCSS.length) break;

      // @-rules: pass through
      if (rawCSS[i] === "@") {
        const atResult = this._readAtRule(rawCSS, i);
        result += atResult.text;
        i = atResult.end;
        continue;
      }

      // Read selector(s) up to '{'
      const bracePos = rawCSS.indexOf("{", i);
      if (bracePos < 0) {
        result += rawCSS.substring(i);
        break;
      }

      const selectorBlock = rawCSS.substring(i, bracePos);
      i = bracePos;

      // Scope each comma-separated selector
      const selectors = selectorBlock.split(",");
      const scoped = selectors.map((sel, idx) => {
        const trimmed = sel.trim();
        if (!trimmed) return sel;
        // Idempotence: don't double-prefix
        if (trimmed.startsWith(prefixTrimmed)) return trimmed;
        return prefix + trimmed;
      });
      result += scoped.join(",") + " ";

      // Append block body
      const blockResult = this._readBlock(rawCSS, i);
      result += blockResult.text;
      i = blockResult.end;
    }

    return result;
  }

  private _readAtRule(css: string, start: number): { text: string; end: number } {
    let i = start;
    // Read until '{' or ';'
    while (i < css.length && css[i] !== "{" && css[i] !== ";") i++;

    if (i >= css.length) {
      return { text: css.substring(start), end: i };
    }

    if (css[i] === ";") {
      i++;
      return { text: css.substring(start, i), end: i };
    }

    // Has a block
    const keyword = css.substring(start, i);
    const block = this._readBlock(css, i);
    return { text: keyword + block.text, end: block.end };
  }

  private _readBlock(css: string, start: number): { text: string; end: number } {
    if (start >= css.length || css[start] !== "{") {
      return { text: "", end: start };
    }

    let depth = 0;
    let i = start;
    while (i < css.length) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    return { text: css.substring(start, i), end: i };
  }
}
