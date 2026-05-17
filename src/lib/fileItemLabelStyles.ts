import type { FileItem, FileItemColor, FileItemLabelColor, FileItemLabelPreset } from "@/types/fileSystem";
import { hexToRgba, parseStoredColor } from "@/lib/menuColorUtils";

/** Pickable colors (includes default for normalization only). */
export const FILE_ITEM_LABEL_COLOR_OPTIONS: FileItemLabelColor[] = [
  "default",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
];

/** chromatic options only (for swatch UI), editor order–like rainbow + gray */
export const FILE_ITEM_LABEL_SWATCH_ORDER: Exclude<FileItemLabelColor, "default">[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "gray",
];

/** Solid hex for round swatches (matches node menu feel). */
export const FILE_ITEM_LABEL_SWATCH_HEX: Record<
  Exclude<FileItemLabelColor, "default">,
  string
> = {
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  pink: "#ec4899",
  gray: "#a1a1aa",
};

const LABEL_SET = new Set<string>(FILE_ITEM_LABEL_COLOR_OPTIONS);

const PRESET_NAME_SET = new Set<string>(
  FILE_ITEM_LABEL_SWATCH_ORDER as unknown as string[],
);

export function isPresetFileItemColor(s: string): s is FileItemLabelPreset {
  return PRESET_NAME_SET.has(s);
}

export function hasFileItemLabel(item: FileItem): boolean {
  const c = item.color;
  return c != null && c !== "";
}

/** Normalize persisted sidebar label color (preset key or CSS color string). */
export function normalizeFileItemStoredColor(raw: unknown): FileItemColor | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw !== "string") return undefined;
  if (raw === "default") return undefined;
  if (LABEL_SET.has(raw) && raw !== "default") return raw as FileItemLabelPreset;
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw)) return raw;
  if (parseStoredColor(raw)) return raw;
  return undefined;
}

/** Maps stored FileItem.color to rgba for the shared RowTint picker (legacy presets → ~15% tint). */
export function fileItemColorToPickerValue(color: FileItem["color"] | undefined): string | null {
  if (!color) return null;
  if (isPresetFileItemColor(color)) {
    const hex = FILE_ITEM_LABEL_SWATCH_HEX[color];
    return hexToRgba(hex, 15);
  }
  if (parseStoredColor(color)) return color;
  return null;
}

/**
 * Full-row background tint when label is set (idle / non-active selection).
 * Hover intensifies tint — avoids fighting generic `hover:bg-zinc-900` when combined carefully in FileSidebar.
 */
export const SIDEBAR_LABEL_TINT_IDLE: Record<FileItemLabelColor, string> = {
  default: "",
  red: "bg-red-500/15 hover:bg-red-500/22",
  orange: "bg-orange-500/15 hover:bg-orange-500/22",
  yellow: "bg-yellow-500/[0.16] hover:bg-yellow-500/24",
  green: "bg-emerald-500/15 hover:bg-emerald-500/22",
  blue: "bg-blue-500/15 hover:bg-blue-500/22",
  purple: "bg-purple-500/15 hover:bg-purple-500/22",
  pink: "bg-pink-500/15 hover:bg-pink-500/22",
  gray: "bg-zinc-500/15 hover:bg-zinc-500/22",
};

/** Stronger row fill when item is active / folder selected (still readable on dark). */
export const SIDEBAR_LABEL_TINT_ACTIVE: Record<FileItemLabelColor, string> = {
  default: "",
  red: "bg-red-500/22 hover:bg-red-500/28",
  orange: "bg-orange-500/22 hover:bg-orange-500/28",
  yellow: "bg-yellow-500/23 hover:bg-yellow-500/30",
  green: "bg-emerald-500/22 hover:bg-emerald-500/28",
  blue: "bg-blue-500/22 hover:bg-blue-500/28",
  purple: "bg-purple-500/22 hover:bg-purple-500/28",
  pink: "bg-pink-500/22 hover:bg-pink-500/28",
  gray: "bg-zinc-500/20 hover:bg-zinc-500/27",
};
