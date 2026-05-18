import { create } from "zustand";

export type MobileUiState = {
  /** Touch-friendly multi-select: mimics holding Alt while clicking nodes. */
  isMobileSelectionMode: boolean;
  setMobileSelectionMode: (next: boolean) => void;
  toggleMobileSelectionMode: () => void;
};

export const useMobileUiStore = create<MobileUiState>((set) => ({
  isMobileSelectionMode: false,
  setMobileSelectionMode: (next) => set({ isMobileSelectionMode: next }),
  toggleMobileSelectionMode: () =>
    set((s) => ({ isMobileSelectionMode: !s.isMobileSelectionMode })),
}));
