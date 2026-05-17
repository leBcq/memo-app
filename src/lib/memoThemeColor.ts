import type { CSSProperties } from "react";
import type { MemoType } from "@/types/memoKind";
import type { FileItemColor } from "@/types/fileSystem";
import { isPresetFileItemColor, FILE_ITEM_LABEL_SWATCH_HEX } from "@/lib/fileItemLabelStyles";
import { parseStoredColor, isColorFullyTransparent } from "@/lib/menuColorUtils";

/** Re-export for call sites that already import from memoThemeColor. */
export { isColorFullyTransparent } from "@/lib/menuColorUtils";

/**
 * Extracts opaque `#rrggbb` from a theme/CSS string (ignores alpha).
 * Handles `#RRGGBB`, `#RRGGBBAA`, `rgba(…)`, modern `rgb(… / …)`, etc.
 */
export function solidHexFromThemeCssString(color: string): string | null {
  const s = color.trim();
  if (!s) return null;
  const norm = normalizeHexColorOrNull(s);
  if (norm) return norm;
  const p = parseStoredColor(s);
  if (p?.hex) return normalizeHexColorOrNull(p.hex);
  const m8 = s.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/i);
  if (m8) return `#${m8[1].toLowerCase()}`;
  return null;
}

/** Text / icons: always full-opacity hue; alpha from row tint must not apply. */
export function getSolidThemeColor(themeColor: string, fallback: string): string {
  return solidHexFromThemeCssString(themeColor) ?? fallback;
}

/** Fallback hue when `Memo.themeColor` is null / invalid (per memo kind). */
export const DEFAULT_MEMO_THEME_COLOR: Record<MemoType, string> = {
  standard: "#ffffff",
  /** Magenta–pink (tailwind fuchsia-400 family) */
  music: "#e879f9",
  /** Cyber cyan */
  gamedev: "#00f0ff",
};

const HEX6 = /^#([0-9a-fA-F]{6})$/;

/** Valid stored value: `#rrggbb` lowercase, or `null` (= use default for memo type). */
export function normalizeHexColorOrNull(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (HEX6.test(s)) return `#${s.slice(1).toLowerCase()}`;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return null;
}

export function getEffectiveMemoThemeColor(memo: {
  memoType: MemoType;
  themeColor?: string | null;
}): string {
  const raw = memo.themeColor;
  if (raw != null && typeof raw === "string" && raw.trim() !== "") {
    const solid = solidHexFromThemeCssString(raw);
    if (solid) return solid;
  }
  return DEFAULT_MEMO_THEME_COLOR[memo.memoType];
}

/** Same as {@link getEffectiveMemoThemeColor}; use for sidebar titles + editor chrome. */
export const getMemoThemeColor = getEffectiveMemoThemeColor;

/** Readable default for editor body, memo title, and notes (not the theme accent). */
export const EDITOR_STANDARD_TEXT_COLOR = "#e4e4e7";
export const EDITOR_STANDARD_CARET_COLOR = "#d4d4d8";
/** Slightly softer for expanded “note” rows under a node. */
export const EDITOR_NOTE_TEXT_COLOR = "#d4d4d8";
export const EDITOR_NOTE_CARET_COLOR = "#e4e4e7";
export const EDITOR_COMPLETED_TEXT_COLOR = "#71717a";
export const EDITOR_COMPLETED_CARET_COLOR = "#a1a1aa";

export function hexToRgbTuple(hex: string): [number, number, number] | null {
  const m = HEX6.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex: string, alpha: number): string {
  const t = hexToRgbTuple(hex);
  if (!t) return `rgba(255,255,255,${alpha})`;
  const [r, g, b] = t;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function withAlpha(hex: string, alpha: number): string {
  return hexToRgba(hex, alpha);
}

/**
 * 0–1 multiplier from the sidebar row tint alpha (custom rgba / #RRGGBBAA).
 * Presets and opaque hex behave as 1 so editor chrome stays unchanged.
 */
export function fileItemColorThemeChromeAlphaMultiplier(
  color: FileItemColor | null | undefined,
): number {
  if (color == null || color === "" || color === "default") return 1;
  if (typeof color !== "string") return 1;
  if (isPresetFileItemColor(color)) return 1;
  if (isColorFullyTransparent(color)) return 0;
  const p = parseStoredColor(color);
  if (!p) return 1;
  return Math.max(0, Math.min(1, p.opacity / 100));
}

/** Row-tint opacity ~0: skip drawing themed borders/fills/rings (text may still use solid `themeColor`). */
export const THEME_CHROME_OFF_EPSILON = 1e-4;

export function isThemeChromeInvisible(chromeAlphaMult: number): boolean {
  return !Number.isFinite(chromeAlphaMult) || chromeAlphaMult <= THEME_CHROME_OFF_EPSILON;
}

/**
 * Mode-strip badge: fully transparent chrome — kills any stray border from utilities or solid HEX on frames.
 * Uses multiplier plus a defensive re-parse of `FileItem.color` (rgba / #RRGGBBAA) so alpha 0 is never missed.
 */
export function isModeStripTintFullyTransparent(
  chromeAlphaMult: number,
  rawRowTint?: FileItemColor | null,
): boolean {
  const n = Number(chromeAlphaMult);
  if (n === 0 || n === -0) return true;
  if (isThemeChromeInvisible(n)) return true;

  if (typeof rawRowTint === "string" && isColorFullyTransparent(rawRowTint)) return true;

  if (rawRowTint == null || rawRowTint === "" || rawRowTint === "default") return false;
  if (typeof rawRowTint !== "string") return false;
  if (isPresetFileItemColor(rawRowTint)) return false;

  const parsed = parseStoredColor(rawRowTint);
  if (parsed && parsed.opacity <= 0) return true;

  const hex8 = rawRowTint.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/i);
  if (hex8 && parseInt(hex8[2], 16) === 0) return true;

  const rgbaTail = rawRowTint.match(
    /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i,
  );
  if (rgbaTail) {
    const a = parseFloat(rgbaTail[1]);
    if (!Number.isNaN(a) && a <= THEME_CHROME_OFF_EPSILON) return true;
  }

  return false;
}

const PHI = (1 + Math.sqrt(5)) / 2;
/** Light wash (10–15% band): independent of row-tint slider. */
const MODE_BADGE_BG_ALPHA = 0.127;
/** Golden-ratio edge strength ≈ 1/φ² — rim, glow, and label halo scale from this. */
const MODE_BADGE_PHI_EDGE = 1 / (PHI * PHI);

/** Container for «◆ MUSIC» / «◆ GAMEDEV» — fixed φ-based wash; ignores row-tint alpha. */
export function modeStripBadgeCellStyle(
  themeColor: string,
  _chromeAlphaMult: number,
  _fullyTransparent: boolean,
): CSSProperties {
  const solid = getSolidThemeColor(themeColor, "#a1a1aa");
  return {
    borderTop: "none",
    borderBottom: "none",
    borderLeft: "none",
    borderRightWidth: 1,
    borderRightStyle: "solid",
    borderRightColor: hexToRgba(solid, MODE_BADGE_PHI_EDGE * 0.72),
    backgroundColor: hexToRgba(solid, MODE_BADGE_BG_ALPHA),
    outline: "none",
    boxShadow: "none",
  };
}

export function modeStripBadgeDiamondStyle(
  themeColor: string,
  _chromeAlphaMult: number,
  _fullyTransparent: boolean,
): CSSProperties {
  const solid = getSolidThemeColor(themeColor, "#ffffff");
  return {
    background: solid,
    backgroundColor: solid,
    opacity: 1,
    boxShadow: `0 0 10px ${hexToRgba(solid, MODE_BADGE_PHI_EDGE * 0.55)}`,
  };
}

export function modeStripBadgeLabelStyle(
  themeColor: string,
  _chromeAlphaMult: number,
  _fullyTransparent: boolean,
): CSSProperties {
  const solid = getSolidThemeColor(themeColor, "#e4e4e7");
  return {
    color: solid,
    WebkitTextFillColor: solid,
    opacity: 1,
    textShadow: `0 0 8px ${hexToRgba(solid, MODE_BADGE_PHI_EDGE * 0.35)}`,
  };
}

/** Theme-tinted chrome (borders, fills, glows) — fades with row alpha; use plain `themeColor` for text/hue. */
export function themeChromeRgba(themeColor: string, baseAlpha: number, chromeAlphaMult: number): string {
  const a = baseAlpha * chromeAlphaMult;
  if (!Number.isFinite(a) || a <= THEME_CHROME_OFF_EPSILON) return "transparent";
  const hex =
    solidHexFromThemeCssString(themeColor) ?? normalizeHexColorOrNull(themeColor) ?? "#ffffff";
  return hexToRgba(hex, a);
}

/**
 * Maps sidebar RowTint / FileItem.color (preset, hex, rgba) to Memo.themeColor (#rrggbb).
 */
export function fileItemColorToMemoThemeHex(
  color: FileItemColor | null | undefined,
): string | null {
  if (color == null || color === "" || color === "default") return null;
  if (typeof color !== "string") return null;
  if (isPresetFileItemColor(color)) {
    return normalizeHexColorOrNull(FILE_ITEM_LABEL_SWATCH_HEX[color]);
  }
  const parsed = parseStoredColor(color);
  if (parsed) return normalizeHexColorOrNull(parsed.hex);
  return normalizeHexColorOrNull(color);
}
