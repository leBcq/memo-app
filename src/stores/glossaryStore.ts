"use client";

import { create } from "zustand";

const STORAGE_KEY = "freavia-glossary-enabled";

type GlossaryStore = {
  /** Whether the [[word:def]] glossary overlay is shown in view mode. */
  enabled: boolean;
  toggle: () => void;
};

export const useGlossaryStore = create<GlossaryStore>((set) => ({
  enabled: true, // SSR-safe default; client hydration overwrites below
  toggle: () =>
    set((s) => {
      const next = !s.enabled;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, String(next));
        }
      } catch {
        /* ignore */
      }
      return { enabled: next };
    }),
}));

// Client-side only: restore persisted value after module evaluation.
// typeof window check ensures this block never runs during SSR.
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      useGlossaryStore.setState({ enabled: stored !== "false" });
    }
  } catch {
    /* ignore */
  }
}
