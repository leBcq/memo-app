import { create } from "zustand";

export type ShareModalState = {
  isShareModalOpen: boolean;
  shareTargetMemoId: string | null;
  openShareModal: (memoId: string) => void;
  closeShareModal: () => void;
};

export const useShareModalStore = create<ShareModalState>((set) => ({
  isShareModalOpen: false,
  shareTargetMemoId: null,
  openShareModal: (memoId) =>
    set({ isShareModalOpen: true, shareTargetMemoId: memoId }),
  closeShareModal: () =>
    set({ isShareModalOpen: false, shareTargetMemoId: null }),
}));
