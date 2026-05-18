import { create } from "zustand";

export const SIDEBAR_TOGGLE_Y_STORAGE_KEY = "geo-memo:sidebar-toggle-y";
/** ~ `top-20` (5rem) as first-run default */
export const SIDEBAR_TOGGLE_Y_DEFAULT_PX = 80;
export const SIDEBAR_TOGGLE_Y_MARGIN = 60;

export function clampSidebarToggleY(y: number): number {
  if (typeof window === "undefined") return y;
  const minY = SIDEBAR_TOGGLE_Y_MARGIN;
  const maxY = window.innerHeight - SIDEBAR_TOGGLE_Y_MARGIN;
  return Math.min(maxY, Math.max(minY, y));
}

function readStoredY(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_TOGGLE_Y_STORAGE_KEY);
    if (raw == null) return SIDEBAR_TOGGLE_Y_DEFAULT_PX;
    const n = Number(raw);
    return Number.isFinite(n) ? clampSidebarToggleY(n) : SIDEBAR_TOGGLE_Y_DEFAULT_PX;
  } catch {
    return SIDEBAR_TOGGLE_Y_DEFAULT_PX;
  }
}

type SidebarTogglePositionState = {
  yPx: number;
  hydrated: boolean;
  hydrate: () => void;
  setY: (y: number) => void;
  clampToViewport: () => void;
};

export const useSidebarTogglePositionStore = create<SidebarTogglePositionState>((set, get) => ({
  yPx: SIDEBAR_TOGGLE_Y_DEFAULT_PX,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ yPx: readStoredY(), hydrated: true });
  },

  setY: (y) => {
    const c = clampSidebarToggleY(y);
    set({ yPx: c });
    try {
      localStorage.setItem(SIDEBAR_TOGGLE_Y_STORAGE_KEY, String(c));
    } catch {
      /* ignore quota / private mode */
    }
  },

  clampToViewport: () => {
    const c = clampSidebarToggleY(get().yPx);
    if (c !== get().yPx) {
      set({ yPx: c });
      try {
        localStorage.setItem(SIDEBAR_TOGGLE_Y_STORAGE_KEY, String(c));
      } catch {
        /* ignore */
      }
    }
  },
}));
