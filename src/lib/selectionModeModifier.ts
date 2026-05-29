import type { KeyCombo } from "@/config/keybinds";

/** Held modifier that activates block-selection mode (default: Ctrl). */
export type SelectionModeModifier = "ctrl" | "alt" | "shift" | "meta";

export const DEFAULT_SELECTION_MODE_MODIFIER: SelectionModeModifier = "ctrl";

export const SELECTION_MODE_MODIFIER_OPTIONS: SelectionModeModifier[] = [
  "ctrl",
  "alt",
  "shift",
  "meta",
];

const MODIFIER_KEY: Record<SelectionModeModifier, string> = {
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
  meta: "Meta",
};

export function normalizeSelectionModeModifier(raw: unknown): SelectionModeModifier {
  if (raw === "ctrl" || raw === "alt" || raw === "shift" || raw === "meta") return raw;
  return DEFAULT_SELECTION_MODE_MODIFIER;
}

export function selectionModeModifierKeyName(mod: SelectionModeModifier): string {
  return MODIFIER_KEY[mod];
}

export function isSelectionModeModifierKeyEvent(
  mod: SelectionModeModifier,
  e: KeyboardEvent,
): boolean {
  return e.key === MODIFIER_KEY[mod];
}

export function isSelectionModifierHeld(
  mod: SelectionModeModifier,
  e: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
): boolean {
  switch (mod) {
    case "ctrl":
      return e.ctrlKey;
    case "alt":
      return e.altKey;
    case "shift":
      return e.shiftKey;
    case "meta":
      return e.metaKey;
  }
}

export function selectionModeModifierLabel(mod: SelectionModeModifier): string {
  switch (mod) {
    case "ctrl":
      return "Ctrl";
    case "alt":
      return "Alt";
    case "shift":
      return "Shift";
    case "meta":
      return "Meta";
  }
}

/** Short label for context-menu hints (e.g. Ctrl+→). */
export function selectionModeModifierPlusKey(mod: SelectionModeModifier, key: string): string {
  return `${selectionModeModifierLabel(mod)}+${key}`;
}

/** Legacy Alt combos in DEFAULT_KEYMAP — unchanged; only block-select hold key moves to Ctrl. */
export function keyComboUsesAlt(combo: KeyCombo): boolean {
  return Boolean(combo.alt);
}
