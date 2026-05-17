import type { NoteNode } from "@/types/note";
import type { MemoMusicMeta, MemoGamedevMeta, MemoType } from "@/types/memoKind";

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
};
