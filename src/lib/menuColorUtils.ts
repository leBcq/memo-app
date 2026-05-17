/** Shared presets — matches STYLE menus in the editor. */
export const MENU_COLOR_PRESETS = [
  "#e0e0e6",
  "#a78bfa",
  "#60dfcd",
  "#f87171",
  "#fbbf24",
  "#4ade80",
] as const;

export function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${(Math.max(0, Math.min(100, opacity)) / 100).toFixed(2)})`;
}

/** Opacity (0–100) at or below this counts as fully transparent for chrome. */
const CHROME_OPACITY_EPS = 0.01;

export function parseStoredColor(color: string | null): { hex: string; opacity: number } | null {
  if (!color) return null;
  const trimmed = color.trim();

  // Modern: rgb(r g b / a) — e.g. rgb(0 240 255 / 0)
  const modern = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([^)]+?))?\s*\)$/i,
  );
  if (modern) {
    const [, rs, gs, bs, aPart] = modern;
    const r = Math.round(Number(rs));
    const g = Math.round(Number(gs));
    const b = Math.round(Number(bs));
    if ([r, g, b].some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return null;
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    if (!aPart?.trim()) return { hex, opacity: 100 };
    const ap = aPart.trim();
    let a: number;
    if (ap.endsWith("%")) {
      a = parseFloat(ap.slice(0, -1)) / 100;
    } else {
      a = parseFloat(ap);
    }
    if (!Number.isFinite(a)) return { hex, opacity: 100 };
    return { hex, opacity: Math.round(Math.max(0, Math.min(1, a)) * 100) };
  }

  const rgbaComma = trimmed.match(
    /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+%?))?\s*\)$/,
  );
  if (rgbaComma) {
    const [, r, g, b, aRaw] = rgbaComma;
    const hex = `#${Number(r).toString(16).padStart(2, "0")}${Number(g).toString(16).padStart(2, "0")}${Number(b).toString(16).padStart(2, "0")}`;
    if (aRaw == null || aRaw === "") {
      return { hex, opacity: 100 };
    }
    let a: number;
    if (aRaw.endsWith("%")) {
      a = parseFloat(aRaw.slice(0, -1)) / 100;
    } else {
      a = parseFloat(aRaw);
    }
    if (!Number.isFinite(a)) return { hex, opacity: 100 };
    return { hex, opacity: Math.round(Math.max(0, Math.min(1, a)) * 100) };
  }

  const hex8 = trimmed.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/);
  if (hex8) {
    return { hex: `#${hex8[1]}`, opacity: Math.round((parseInt(hex8[2], 16) / 255) * 100) };
  }
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return { hex: trimmed, opacity: 100 };
  return null;
}

/**
 * True when a CSS color string is fully transparent (rgba alpha 0, #RRGGBB00, `transparent`, etc.).
 */
export function isColorFullyTransparent(color: string | null | undefined): boolean {
  if (color == null || typeof color !== "string") return false;
  const s = color.trim();
  if (s === "") return false;
  const low = s.toLowerCase();
  if (low === "transparent") return true;

  const hex8 = s.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/);
  if (hex8 && parseInt(hex8[2], 16) === 0) return true;

  const p = parseStoredColor(s);
  if (p && p.opacity <= CHROME_OPACITY_EPS) return true;

  const hsla = low.match(
    /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(?:,\s*([\d.]+%?)\s*)?\)$/,
  );
  if (hsla?.[1]) {
    const raw = hsla[1];
    const a = raw.endsWith("%") ? parseFloat(raw.slice(0, -1)) / 100 : parseFloat(raw);
    if (Number.isFinite(a) && a <= CHROME_OPACITY_EPS) return true;
  }
  const hslModern = low.match(/^hsla?\(\s*[\d.]+\s+[\d.]+%\s+[\d.]+%\s*\/\s*([^)]+)\s*\)$/);
  if (hslModern) {
    const ap = hslModern[1].trim();
    const a = ap.endsWith("%") ? parseFloat(ap.slice(0, -1)) / 100 : parseFloat(ap);
    if (Number.isFinite(a) && a <= CHROME_OPACITY_EPS) return true;
  }

  return false;
}

/** Used for sidebar row idle / hover / active (multiply alpha). */
export function adjustStoredColorAlpha(cssColor: string, factor: number): string {
  const p = parseStoredColor(cssColor);
  if (!p) return cssColor;
  const next = Math.min(100, Math.max(0, Math.round(p.opacity * factor)));
  return hexToRgba(p.hex, next);
}
