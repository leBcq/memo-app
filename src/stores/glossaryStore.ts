import { create } from "zustand";

const STORAGE_KEY = "freavia-glossary-enabled";

function readEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v !== "false";
  } catch {
    return true;
  }
}

type GlossaryStore = {
  /** Whether the [[word:def]] glossary overlay is shown in view mode. */
  enabled: boolean;
  toggle: () => void;
};

export const useGlossaryStore = create<GlossaryStore>((set) => ({
  enabled: readEnabled(),
  toggle: () =>
    set((s) => {
      const next = !s.enabled;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return { enabled: next };
    }),
}));
