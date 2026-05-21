import { create } from "zustand";

export type MobileUiState = {
  /** Touch-friendly multi-select: mimics holding Alt while clicking nodes. */
  isMobileSelectionMode: boolean;
  setMobileSelectionMode: (next: boolean) => void;
  toggleMobileSelectionMode: () => void;
  /** Rich text / format strip (B, I, U, size, color) — mobile only; desktop ignores. */
  isMobileRichTextToolbarOpen: boolean;
  setMobileRichTextToolbarOpen: (next: boolean) => void;
  toggleMobileRichTextToolbar: () => void;
};

export const useMobileUiStore = create<MobileUiState>((set) => ({
  isMobileSelectionMode: false,
  setMobileSelectionMode: (next) => set({ isMobileSelectionMode: next }),
  toggleMobileSelectionMode: () =>
    set((s) => ({ isMobileSelectionMode: !s.isMobileSelectionMode })),
  isMobileRichTextToolbarOpen: false,
  setMobileRichTextToolbarOpen: (next) => set({ isMobileRichTextToolbarOpen: next }),
  toggleMobileRichTextToolbar: () =>
    set((s) => ({ isMobileRichTextToolbarOpen: !s.isMobileRichTextToolbarOpen })),
}));
