import type { FileItem } from "@/types/fileSystem";

export type MemoWorkspaceSnapshot<TMemo extends { id: string }> = {
  memo: TMemo;
  fileItem: FileItem | undefined;
};

export function cloneWorkspaceSnapshot<TMemo extends { id: string }>(
  memos: readonly TMemo[],
  fileItems: readonly FileItem[],
  memoId: string,
): MemoWorkspaceSnapshot<TMemo> | null {
  const memo = memos.find((m) => m.id === memoId);
  if (!memo) return null;
  const fileItem = fileItems.find((i) => i.id === memoId && i.type === "memo");
  return {
    memo: structuredClone(memo),
    fileItem: fileItem ? structuredClone(fileItem) : undefined,
  };
}

export function workspaceSnapshotsEqual<TMemo extends { id: string }>(
  a: MemoWorkspaceSnapshot<TMemo>,
  b: MemoWorkspaceSnapshot<TMemo>,
): boolean {
  return (
    JSON.stringify({ memo: a.memo, fileItem: a.fileItem }) ===
    JSON.stringify({ memo: b.memo, fileItem: b.fileItem })
  );
}
