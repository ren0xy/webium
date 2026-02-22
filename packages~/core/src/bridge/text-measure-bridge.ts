type NativeMeasureText = (
    argsJson: string
) => string;

let _native: NativeMeasureText | null = null;

export function initTextMeasureBridge(): void {
    _native = (globalThis as any).__webium_measureText ?? null;
}

export function measureText(
    text: string, fontFamily: string, fontSize: number,
    fontWeight: string, fontStyle: string
): { width: number; height: number } {
    if (_native) {
        const json = JSON.stringify({ text, fontFamily, fontSize, fontWeight, fontStyle });
        const resultJson = _native(json);
        const result = JSON.parse(resultJson);
        return { width: result.width, height: result.height };
    }
    const w = text.length * fontSize * 0.6;
    const h = fontSize * 1.2;
    // Heuristic fallback for environments without native measurement
    return {
        width: w,
        height: h,
    };
}
