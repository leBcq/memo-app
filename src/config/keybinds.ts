export type KeyCombo = {
  key: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
};

export const KEYBINDS = {
  ADD_SIBLING: { key: "Enter", shift: false } satisfies KeyCombo,
  SOFT_BREAK: { key: "Enter", shift: true } satisfies KeyCombo,
  INDENT: { key: "Tab", shift: false } satisfies KeyCombo,
  UNINDENT: { key: "Tab", shift: true } satisfies KeyCombo,
  BOLD: { key: "b", ctrl: true } satisfies KeyCombo,
  ITALIC: { key: "i", ctrl: true } satisfies KeyCombo,
} as const;

export function matchesKeybind(
  e: React.KeyboardEvent | KeyboardEvent,
  combo: KeyCombo,
): boolean {
  return (
    e.key === combo.key &&
    Boolean(e.shiftKey) === (combo.shift ?? false) &&
    Boolean(e.ctrlKey || e.metaKey) === ((combo.ctrl ?? false) || (combo.meta ?? false)) &&
    Boolean(e.altKey) === (combo.alt ?? false)
  );
}
