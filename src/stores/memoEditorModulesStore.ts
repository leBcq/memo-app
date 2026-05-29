import { create } from "zustand";
import type { MemoType } from "@/types/memoKind";

/** Per-memo optional editor modules (music BPM strip, gamedev toolbar, future card inserters). */
export type MemoEditorModuleFlags = {
  musicToolbar: boolean;
  gamedevToolbar: boolean;
};

type MemoEditorModulesState = {
  byMemoId: Record<string, Partial<MemoEditorModuleFlags>>;
  setModuleFlag: (
    memoId: string,
    key: keyof MemoEditorModuleFlags,
    visible: boolean,
  ) => void;
  toggleModuleFlag: (memoId: string, key: keyof MemoEditorModuleFlags) => void;
  /** Legacy memo kinds always show their strip; standard memos use toggled flags. */
  isMusicToolbarVisible: (memoId: string, memoType: MemoType) => boolean;
  isGamedevToolbarVisible: (memoId: string, memoType: MemoType) => boolean;
  clearMemoModules: (memoId: string) => void;
};

export const useMemoEditorModulesStore = create<MemoEditorModulesState>((set, get) => ({
  byMemoId: {},
  setModuleFlag: (memoId, key, visible) =>
    set((s) => ({
      byMemoId: {
        ...s.byMemoId,
        [memoId]: { ...s.byMemoId[memoId], [key]: visible },
      },
    })),
  toggleModuleFlag: (memoId, key) => {
    const cur = get().byMemoId[memoId]?.[key] ?? false;
    get().setModuleFlag(memoId, key, !cur);
  },
  isMusicToolbarVisible: (memoId, memoType) => {
    if (memoType === "music") return true;
    return Boolean(get().byMemoId[memoId]?.musicToolbar);
  },
  isGamedevToolbarVisible: (memoId, memoType) => {
    if (memoType === "gamedev") return true;
    return Boolean(get().byMemoId[memoId]?.gamedevToolbar);
  },
  clearMemoModules: (memoId) =>
    set((s) => {
      const next = { ...s.byMemoId };
      delete next[memoId];
      return { byMemoId: next };
    }),
}));
