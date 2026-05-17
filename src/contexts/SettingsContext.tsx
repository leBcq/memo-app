"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { KeyCombo } from "@/config/keybinds";
import type { UiLocale } from "@/i18n/messages";

// ─── Types ───────────────────────────────────────────────────────────────────

export type KeymapSettings = {
  ADD_SIBLING: KeyCombo;
  SOFT_BREAK: KeyCombo;
  INDENT: KeyCombo;
  UNINDENT: KeyCombo;
  FOCUS_NODE: KeyCombo;
  UNFOCUS_NODE: KeyCombo;
};

export type FontFamily = "mono" | "sans";
export type EditorWidth = "narrow" | "wide" | "full";

export type AppearanceSettings = {
  baseFontSize: number;   // px, 10-24
  fontFamily: FontFamily;
  editorWidth: EditorWidth;
  bulletClickFocus: boolean;
  /** UI language (EN / JA), persisted with settings. */
  locale: UiLocale;
};

export type Settings = {
  keymap: KeymapSettings;
  appearance: AppearanceSettings;
};

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_KEYMAP: KeymapSettings = {
  ADD_SIBLING:  { key: "Enter",      shift: false },
  SOFT_BREAK:   { key: "Enter",      shift: true  },
  INDENT:       { key: "Tab",        shift: false },
  UNINDENT:     { key: "Tab",        shift: true  },
  FOCUS_NODE:   { key: "ArrowRight", alt: true    },
  UNFOCUS_NODE: { key: "ArrowLeft",  alt: true    },
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  baseFontSize: 14,
  fontFamily: "mono",
  editorWidth: "wide",
  bulletClickFocus: true,
  locale: "ja",
};

const DEFAULT_SETTINGS: Settings = {
  keymap: DEFAULT_KEYMAP,
  appearance: DEFAULT_APPEARANCE,
};

const STORAGE_KEY = "geo-memo-settings-v1";

// ─── CSS variable helpers ─────────────────────────────────────────────────────

const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  mono: "var(--font-geist-mono), 'Courier New', monospace",
  sans: "var(--font-geist-sans), Arial, sans-serif",
};

const EDITOR_WIDTH_MAP: Record<EditorWidth, string> = {
  narrow: "42rem",   // ~672px
  wide:   "56rem",   // ~896px (current default)
  full:   "100%",
};

function applyAppearanceCssVars(appearance: AppearanceSettings) {
  const root = document.documentElement;
  root.style.setProperty("--editor-font-size",   `${appearance.baseFontSize}px`);
  root.style.setProperty("--editor-font-family", FONT_FAMILY_MAP[appearance.fontFamily]);
  root.style.setProperty("--editor-max-width",   EDITOR_WIDTH_MAP[appearance.editorWidth]);
}

// ─── Serialization helpers ────────────────────────────────────────────────────

/** Convert a KeyCombo to a human-readable string, e.g. "Shift+Enter" */
export function keyComboToLabel(combo: KeyCombo): string {
  const parts: string[] = [];
  if (combo.ctrl || combo.meta) parts.push("Ctrl");
  if (combo.alt)   parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  parts.push(combo.key);
  return parts.join("+");
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const appearance = { ...DEFAULT_APPEARANCE, ...(parsed.appearance ?? {}) };
    if (appearance.locale !== "en" && appearance.locale !== "ja") {
      appearance.locale = DEFAULT_APPEARANCE.locale;
    }
    return {
      keymap: { ...DEFAULT_KEYMAP, ...(parsed.keymap ?? {}) },
      appearance,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type SettingsContextValue = {
  settings: Settings;
  updateKeymap: (patch: Partial<KeymapSettings>) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateKeymap: () => {},
  updateAppearance: () => {},
  resetSettings: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  // Load & apply on mount
  useEffect(() => {
    const loaded = loadFromStorage();
    setSettings(loaded);
    applyAppearanceCssVars(loaded.appearance);
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  // Reapply CSS vars on appearance change
  useEffect(() => {
    if (!hydrated) return;
    applyAppearanceCssVars(settings.appearance);
  }, [settings.appearance, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof document === "undefined") return;
    document.documentElement.lang = settings.appearance.locale === "ja" ? "ja" : "en";
  }, [settings.appearance.locale, hydrated]);

  const updateKeymap = useCallback((patch: Partial<KeymapSettings>) => {
    setSettings((prev) => ({ ...prev, keymap: { ...prev.keymap, ...patch } }));
  }, []);

  const updateAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setSettings((prev) => ({ ...prev, appearance: { ...prev.appearance, ...patch } }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(
    () => ({ settings, updateKeymap, updateAppearance, resetSettings }),
    [settings, updateKeymap, updateAppearance, resetSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
