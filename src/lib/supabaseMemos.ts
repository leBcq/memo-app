import type { SupabaseClient } from "@supabase/supabase-js";
import type { FileItem } from "@/types/fileSystem";
import type { Memo } from "@/types/memoApp";
import type { NoteNode } from "@/types/note";
import { normalizeMemoType } from "@/types/memoKind";
import { normalizeGamedevStage } from "@/types/gamedev";
import {
  normalizeMusicMeta,
  DEFAULT_GAMEDEV_META,
  DEFAULT_MUSIC_META,
} from "@/types/memoKind";
import { normalizeMemoWorkflowStatus, type MemoWorkflowStatus } from "@/types/memoWorkflow";
import { normalizeNode, cloneNoteTreeForPersistence } from "@/types/note";
import { normalizeHexColorOrNull, fileItemColorToMemoThemeHex } from "@/lib/memoThemeColor";
import { normalizeFileItemStoredColor } from "@/lib/fileItemLabelStyles";

export type MemoDbRow = {
  id: string;
  user_id: string;
  title: string;
  content: unknown;
  theme_color: string | null;
  created_at?: string;
  updated_at?: string;
};

export const FREAVIA_MEMO_CONTENT_V = 1 as const;

export type FreaviaMemoSidebarSlice = {
  parentId: string | null;
  order: number;
  color?: FileItem["color"];
  icon?: string;
  isBookmarked?: boolean;
  workflowStatus?: MemoWorkflowStatus;
};

export type FreaviaMemoContentV1 = {
  v: typeof FREAVIA_MEMO_CONTENT_V;
  memoType: Memo["memoType"];
  musicMeta: Memo["musicMeta"];
  gamedevMeta: Memo["gamedevMeta"];
  nodes: NoteNode[];
  sidebar?: FreaviaMemoSidebarSlice;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function newMemoUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  throw new Error("crypto.randomUUID is required for cloud memo ids");
}

function normalizeGamedevMetaRaw(raw: unknown): Memo["gamedevMeta"] {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GAMEDEV_META };
  const r = raw as Record<string, unknown>;
  return {
    stage: normalizeGamedevStage(r.stage),
  };
}

function parseContentV1(raw: unknown): Omit<FreaviaMemoContentV1, "v"> & { v?: number } {
  if (!raw || typeof raw !== "object") {
    return {
      memoType: "standard",
      musicMeta: null,
      gamedevMeta: null,
      nodes: [],
    };
  }
  const r = raw as Record<string, unknown>;
  const memoType = normalizeMemoType(r.memoType);
  const musicMeta =
    memoType === "music" ? normalizeMusicMeta(r.musicMeta ?? DEFAULT_MUSIC_META) : null;
  const gamedevMeta =
    memoType === "gamedev" ? normalizeGamedevMetaRaw(r.gamedevMeta) : null;
  const nodes = Array.isArray(r.nodes)
    ? r.nodes.map((n) => normalizeNode(n as Partial<NoteNode> & { children?: unknown }))
    : [];
  let sidebar: FreaviaMemoSidebarSlice | undefined;
  const sb = r.sidebar;
  if (sb && typeof sb === "object") {
    const s = sb as Record<string, unknown>;
    const rawParent = s.parentId;
    const parentId =
      rawParent === null || rawParent === undefined
        ? null
        : typeof rawParent === "string"
          ? rawParent
          : null;
    sidebar = {
      parentId,
      order: typeof s.order === "number" ? s.order : 0,
    };
    if (typeof s.icon === "string") sidebar.icon = s.icon;
    if (typeof s.isBookmarked === "boolean") sidebar.isBookmarked = s.isBookmarked;
    const wf = s.workflowStatus;
    if (wf !== undefined && wf !== null) sidebar.workflowStatus = normalizeMemoWorkflowStatus(wf);
    const col = normalizeFileItemStoredColor(s.color);
    if (col !== undefined) sidebar.color = col;
  }
  return { memoType, musicMeta, gamedevMeta, nodes, sidebar };
}

export function memoRowToMemo(row: MemoDbRow): Memo {
  const parsed = parseContentV1(row.content);
  const themeFromLabel =
    parsed.sidebar?.color != null ? fileItemColorToMemoThemeHex(parsed.sidebar.color) : null;
  const themeColor =
    normalizeHexColorOrNull(row.theme_color) ??
    themeFromLabel ??
    normalizeHexColorOrNull((row.content as Record<string, unknown> | undefined)?.themeColor);

  return {
    id: row.id,
    title: typeof row.title === "string" ? row.title : "",
    memoType: parsed.memoType,
    themeColor: themeColor ?? null,
    musicMeta: parsed.musicMeta,
    gamedevMeta: parsed.gamedevMeta,
    nodes: parsed.nodes,
    updatedAt:
      typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

export function fileItemFromRow(memo: Memo, row: MemoDbRow): FileItem {
  const parsed = parseContentV1(row.content);
  const sb = parsed.sidebar;
  const it: FileItem = {
    id: memo.id,
    type: "memo",
    name: memo.title,
    parentId: sb?.parentId ?? null,
    isOpen: false,
    order: sb?.order ?? 0,
    memoType: memo.memoType,
  };
  if (sb?.icon) it.icon = sb.icon;
  if (sb?.isBookmarked) it.isBookmarked = sb.isBookmarked;
  if (sb?.workflowStatus) it.workflowStatus = sb.workflowStatus;
  if (sb?.color !== undefined) it.color = sb.color;
  else if (memo.themeColor) {
    it.color = memo.themeColor;
  }
  return it;
}

export function memoToContentPayload(m: Memo, fileItem: FileItem | undefined): FreaviaMemoContentV1 {
  const base: FreaviaMemoContentV1 = {
    v: FREAVIA_MEMO_CONTENT_V,
    memoType: m.memoType,
    musicMeta: m.musicMeta,
    gamedevMeta: m.gamedevMeta,
    nodes: cloneNoteTreeForPersistence(m.nodes),
  };
  if (!fileItem) return base;
  const sidebar: FreaviaMemoSidebarSlice = {
    parentId: fileItem.parentId,
    order: fileItem.order,
  };
  if (fileItem.icon) sidebar.icon = fileItem.icon;
  if (fileItem.isBookmarked) sidebar.isBookmarked = true;
  if (fileItem.workflowStatus) sidebar.workflowStatus = fileItem.workflowStatus;
  if (fileItem.color !== undefined) sidebar.color = fileItem.color;
  return { ...base, sidebar };
}

/** Stable string for dirty detection (memo + linked file row fields we persist). */
export function cloudMemoFingerprint(m: Memo, fileItem: FileItem | undefined): string {
  const payload = memoToContentPayload(m, fileItem);
  return JSON.stringify({
    title: m.title,
    themeColor: m.themeColor,
    body: payload,
  });
}

export async function fetchUserMemos(
  client: SupabaseClient,
  userId: string,
): Promise<MemoDbRow[]> {
  const { data, error } = await client
    .from("memos")
    .select("id,user_id,title,content,theme_color,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MemoDbRow[];
}

export async function insertMemoRow(
  client: SupabaseClient,
  userId: string,
  memo: Memo,
  fileItem: FileItem | undefined,
): Promise<void> {
  const content = memoToContentPayload(memo, fileItem);
  const { error } = await client.from("memos").insert({
    id: memo.id,
    user_id: userId,
    title: memo.title,
    content,
    theme_color: memo.themeColor,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Insert or replace row by id (covers memos created while cloud session was still connecting). */
export async function upsertMemoRow(
  client: SupabaseClient,
  userId: string,
  memo: Memo,
  fileItem: FileItem | undefined,
): Promise<void> {
  const content = memoToContentPayload(memo, fileItem);
  const { error } = await client.from("memos").upsert(
    {
      id: memo.id,
      user_id: userId,
      title: memo.title,
      content,
      theme_color: memo.themeColor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function updateMemoRow(
  client: SupabaseClient,
  userId: string,
  memo: Memo,
  fileItem: FileItem | undefined,
): Promise<void> {
  const content = memoToContentPayload(memo, fileItem);
  const { error } = await client
    .from("memos")
    .update({
      title: memo.title,
      content,
      theme_color: memo.themeColor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memo.id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteMemoRow(client: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await client.from("memos").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

// ── Folder rows (`freavia_folders`) ───────────────────────────────────────────

export type FreaviaFolderDbRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  is_open: boolean;
  is_bookmarked: boolean;
  icon: string | null;
  color: string | null;
  updated_at?: string;
};

export function folderRowToFileItem(row: FreaviaFolderDbRow): FileItem {
  const it: FileItem = {
    id: row.id,
    type: "folder",
    name: typeof row.name === "string" ? row.name : "",
    parentId: row.parent_id,
    isOpen: Boolean(row.is_open),
    order: typeof row.sort_order === "number" ? row.sort_order : 0,
  };
  if (row.is_bookmarked) it.isBookmarked = true;
  if (row.icon) it.icon = row.icon;
  const col = normalizeFileItemStoredColor(row.color);
  if (col !== undefined) it.color = col;
  return it;
}

/** Stable fingerprint for debounced folder sync. */
export function cloudFoldersFingerprint(folders: FileItem[]): string {
  const list = folders
    .filter((f) => f.type === "folder")
    .map((f) => ({
      id: f.id,
      parentId: f.parentId,
      name: f.name,
      order: f.order,
      isOpen: f.isOpen,
      isBookmarked: f.isBookmarked ?? false,
      icon: f.icon,
      color: f.color,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(list);
}

export async function fetchUserFolders(
  client: SupabaseClient,
  userId: string,
): Promise<FreaviaFolderDbRow[]> {
  const { data, error } = await client
    .from("freavia_folders")
    .select(
      "id,user_id,parent_id,name,sort_order,is_open,is_bookmarked,icon,color,updated_at",
    )
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FreaviaFolderDbRow[];
}

/** Replace the user's folder tree in Supabase (simple snapshot sync). */
export async function replaceUserFolders(
  client: SupabaseClient,
  userId: string,
  folders: FileItem[],
): Promise<void> {
  const { error: delErr } = await client.from("freavia_folders").delete().eq("user_id", userId);
  if (delErr) throw delErr;

  const rows = folders
    .filter((f) => f.type === "folder")
    .map((f) => ({
      id: f.id,
      user_id: userId,
      parent_id: f.parentId,
      name: f.name,
      sort_order: f.order,
      is_open: f.isOpen,
      is_bookmarked: f.isBookmarked ?? false,
      icon: f.icon ?? null,
      color: f.color != null && f.color !== "" ? String(f.color) : null,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return;

  const { error: insErr } = await client.from("freavia_folders").insert(rows);
  if (insErr) throw insErr;
}

/**
 * Remap non-UUID memo ids (legacy localStorage) so Supabase uuid PK accepts them.
 * Folder ids stay unchanged; only memo rows in fileItems are rewritten when their id maps.
 */
export function remapInvalidMemoIds(
  memos: Memo[],
  fileItems: FileItem[],
  activeMemoId: string,
): { memos: Memo[]; fileItems: FileItem[]; activeMemoId: string } | null {
  const needs = memos.some((m) => !isUuid(m.id));
  if (!needs) return null;
  const idMap = new Map<string, string>();
  const nextMemos = memos.map((m) => {
    if (isUuid(m.id)) return m;
    const nid = newMemoUuid();
    idMap.set(m.id, nid);
    return { ...m, id: nid };
  });
  const nextFiles = fileItems.map((it) => {
    let id = it.id;
    let parentId = it.parentId;
    if (it.type === "memo" && idMap.has(id)) id = idMap.get(id)!;
    if (parentId !== null && idMap.has(parentId)) parentId = idMap.get(parentId)!;
    if (id !== it.id || parentId !== it.parentId) return { ...it, id, parentId };
    return it;
  });
  const nextActive = idMap.has(activeMemoId) ? idMap.get(activeMemoId)! : activeMemoId;
  return { memos: nextMemos, fileItems: nextFiles, activeMemoId: nextActive };
}
