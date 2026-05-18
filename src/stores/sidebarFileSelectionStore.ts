import { create } from "zustand";

/**
 * Sidebar file tree multi-select (Explorer-style Ctrl/Cmd + Shift).
 * Separate from editor block-selection (`selectedIds` in page.tsx).
 */
export const useSidebarFileSelectionStore = create<{
  selectedFileIds: string[];
  /** Anchor index into `visibleMainTreeOrder` for Shift+click range selection */
  lastClickedTreeIndex: number | null;
  clearMultiSelect: () => void;
  toggleSelect: (id: string) => void;
  setRange: (flatOrder: string[], anchorIdx: number, endIdx: number) => void;
  setLastClickedTreeIndex: (idx: number | null) => void;
}>((set) => ({
  selectedFileIds: [],
  lastClickedTreeIndex: null,

  clearMultiSelect: () => set({ selectedFileIds: [] }),

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedFileIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedFileIds: [...next] };
    }),

  setRange: (flatOrder, anchorIdx, endIdx) => {
    const [lo, hi] = anchorIdx <= endIdx ? [anchorIdx, endIdx] : [endIdx, anchorIdx];
    set({ selectedFileIds: flatOrder.slice(lo, hi + 1) });
  },

  setLastClickedTreeIndex: (idx) => set({ lastClickedTreeIndex: idx }),
}));
