/**
 * Browser Reference Dump — paste into Edge/Chrome DevTools console
 * while hello-world/index.html is open.
 *
 * Walks the DOM and captures computed styles + layout for every element,
 * limited to the properties Webium actually handles. Output is a JSON
 * array you can save and compare against Webium's reconciliation output.
 */
(function dumpBrowserReference() {
  // --- Properties Webium tracks ---

  // Inherited (from style-inheritance.ts INHERITABLE_PROPERTIES)
  const INHERITED = [
    "color", "font-size", "font-family", "font-weight", "font-style",
    "line-height", "text-align", "visibility", "cursor", "direction",
    "letter-spacing", "word-spacing", "white-space",
  ];

  // Non-inherited (from style-inheritance.ts INITIAL_VALUES)
  const NON_INHERITED = [
    "display", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-width", "background-color", "width", "height", "opacity",
    "overflow", "position",
  ];

  // Layout-relevant (from yoga-layout-engine.ts STYLE_SETTERS)
  const LAYOUT = [
    "min-width", "min-height", "max-width", "max-height",
    "flex-grow", "flex-shrink", "flex-basis", "flex-direction",
    "justify-content", "align-items", "align-self", "align-content",
    "flex-wrap",
  ];

  const ALL_PROPS = [...new Set([...INHERITED, ...NON_INHERITED, ...LAYOUT])];

  function describeElement(el) {
    let selector = el.tagName.toLowerCase();
    if (el.id) selector += "#" + el.id;
    if (el.className) selector += "." + el.className.toString().replace(/\s+/g, ".");
    return selector;
  }

  function walk(el, results) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    const styles = {};
    for (const prop of ALL_PROPS) {
      styles[prop] = cs.getPropertyValue(prop);
    }

    results.push({
      selector: describeElement(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      textContent: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
        ? el.childNodes[0].textContent
        : null,
      layout: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      },
      computedStyles: styles,
    });

    for (const child of el.children) {
      walk(child, results);
    }
  }

  const results = [];
  walk(document.documentElement, results);

  const json = JSON.stringify(results, null, 2);

  // Print to console
  console.log("[Webium:BrowserRef] Dumped " + results.length + " elements");
  console.log(json);

  // Also copy to clipboard if possible
  try {
    copy(json);
    console.log("[Webium:BrowserRef] JSON copied to clipboard — paste into a .json file");
  } catch (e) {
    console.log("[Webium:BrowserRef] copy() not available — select the JSON above manually");
  }

  return results;
})();
