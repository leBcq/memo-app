import type { NoteNode } from "@/types/note";
import type { MemoMusicMeta, MemoGamedevMeta, MemoType } from "@/types/memoKind";

/** Role for the current user when the memo is owned by someone else (from `memo_shares`). */
export type MemoInviteeShareRole = "viewer" | "editor";

/** In-memory memo document (outline + meta) — also the shape persisted to Supabase `content` + columns. */
export type Memo = {
  id: string;
  title: string;
  memoType: MemoType;
  themeColor: string | null;
  musicMeta: MemoMusicMeta | null;
  gamedevMeta: MemoGamedevMeta | null;
  nodes: NoteNode[];
  updatedAt: string;
  /** `memos.user_id` when loaded from cloud; omit on local-only / legacy data. */
  ownerUserId?: string;
  /** Set for invitee: share role for the signed-in user. Omitted for owner. */
  shareRole?: MemoInviteeShareRole;
};

/** True when the current user may not edit body/title/metadata (viewer invitee or unknown shared access). */
export function isMemoReadOnlyForCurrentUser(
  memo: Memo,
  currentUserId: string | null | undefined,
): boolean {
  if (!currentUserId) return false;
  if (!memo.ownerUserId || memo.ownerUserId === currentUserId) return false;
  return memo.shareRole !== "editor";
}
