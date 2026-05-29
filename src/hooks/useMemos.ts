"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  findNodePath,
  mapTree,
  indentNode,
  unindentNode,
  getPrevNodeId,
  insertSiblingNodesAfter,
  flattenPreorderIds,
} from "@/lib/treeUtils";
import type { HeadingLevel, NoteNode, NotePluginData, NoteGameData } from "@/types/note";
import {
  createNode,
  normalizeNode,
  DEFAULT_PLUGIN_DATA,
  DEFAULT_GAME_DATA,
  normalizeGameData,
} from "@/types/note";
import type { FileItem, FileItemColor, FileItemLabelColor } from "@/types/fileSystem";
import type { Memo } from "@/types/memoApp";
import { isMemoReadOnlyForCurrentUser } from "@/types/memoApp";
import { normalizeMemoWorkflowStatus, type MemoWorkflowStatus } from "@/types/memoWorkflow";
import { normalizeFileItemStoredColor } from "@/lib/fileItemLabelStyles";
import type { MemoMusicMeta, MemoGamedevMeta, MemoType } from "@/types/memoKind";
import {
  DEFAULT_GAMEDEV_META,
  DEFAULT_MUSIC_META,
  clampBpm,
  normalizeMemoType,
  normalizeMusicMeta,
  normalizeMusicKey,
  normalizeMusicReleaseStatus,
  normalizeMusicScale,
} from "@/types/memoKind";
import { normalizeGamedevStage } from "@/types/gamedev";
import {
  normalizeHexColorOrNull,
  fileItemColorToMemoThemeHex,
} from "@/lib/memoThemeColor";
import {
  buildFreaviaFullBackupV1,
  downloadFreaviaBackupJson,
  parseFreaviaFullBackupJson,
  applyFreaviaBackupLocalStoragePatches,
} from "@/lib/freaviaBackup";
import {
  cloneWorkspaceSnapshot,
  workspaceSnapshotsEqual,
  type MemoWorkspaceSnapshot,
} from "@/lib/memoWorkspaceSnapshot";
import {
  type HistoryStack,
  createStack,
  stackRecord,
  stackUndo,
  stackRedo,
} from "@/hooks/useHistory";
import {
  fetchUserMemos,
  fetchUserFolders,
  insertMemoRow,
  upsertMemoRow,
  deleteMemoRow,
  memoRowToMemo,
  fileItemFromRow,
  normalizeSharedMemoSidebarPlacement,
  cloudMemoFingerprint,
  cloudFoldersFingerprint,
  replaceUserFolders,
  folderRowToFileItem,
  remapInvalidMemoIds,
  newMemoUuid,
  isUuid,
} from "@/lib/supabaseMemos";
import { fetchInviteeShareRolesByMemoId } from "@/lib/supabaseShares";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const MEMO_KEY = "geo-memo-memos-v1";
const FS_KEY = "geo-memo-fs-v1";

/** Default cloud-safe ids so local-first installs can sync without id migration. */
const DEFAULT_MEMO_ID_TRACK = "a0000001-0001-4000-8001-000000000001";
const DEFAULT_MEMO_ID_GAMEDEV = "a0000002-0002-4000-8002-000000000002";
const DEFAULT_MEMO_ID_IDEAS = "a0000003-0003-4000-8003-000000000003";

/** Deterministic outline node ids for seed memos (never randomUUID — avoids SSR/CSR `data-node-id` mismatch). */
const DEF_NODE_T1 = "b0000001-c001-4000-8001-000000000001";
const DEF_NODE_T2 = "b0000001-c001-4000-8001-000000000002";
const DEF_NODE_T3 = "b0000001-c001-4000-8001-000000000003";
const DEF_NODE_G1 = "b0000002-c002-4000-8002-000000000001";
const DEF_NODE_G2 = "b0000002-c002-4000-8002-000000000002";
const DEF_NODE_I1 = "b0000003-c003-4000-8003-000000000001";
const DEF_NODE_I2 = "b0000003-c003-4000-8003-000000000002";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

/** User-visible cloud error line — includes PostgREST `code` when present. */
function cloudErrorUserMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (isRecord(e) && typeof e.message === "string" && e.message.trim() !== "") {
    const code = typeof e.code === "string" && e.code ? `${e.code}: ` : "";
    return `${code}${e.message}`;
  }
  try {
    const s = JSON.stringify(e);
    if (s && s !== "{}") return s;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Logs sync/save failures with PostgREST fields and stack (never rely on empty `console.error(e)`). */
function logFreaviaCloudError(scope: string, e: unknown) {
  if (e instanceof Error) {
    console.error(scope, e.message, e.stack ?? "(no stack)", e);
    return;
  }
  if (isRecord(e)) {
    const payload = {
      ...e,
      code: e.code,
      message: e.message,
      details: e.details,
      hint: e.hint,
    };
    console.error(scope, payload);
    try {
      console.error(`${scope} json`, JSON.stringify(e));
    } catch {
      console.error(`${scope} (not JSON-serializable)`, String(e));
    }
    return;
  }
  console.error(scope, String(e));
}

type StorageData = {
  memos: Memo[];
  activeMemoId: string;
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const newFolderId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : makeId();

/** Common electronic track sections — each becomes a parent node with one empty child. */
const ELECTRONIC_SONG_STRUCTURE_LABELS = [
  "Intro",
  "Build up",
  "Drop (Chorus)",
  "Break",
  "Outro",
] as const;

/** One-time sync: legacy rows with sidebar tint but no Memo.themeColor get editor parity. */
function mergeMemosThemeFromSidebarLabels(memos: Memo[], fileItems: FileItem[]): Memo[] {
  const byId = new Map(fileItems.filter((i) => i.type === "memo").map((i) => [i.id, i]));
  return memos.map((m) => {
    if (m.themeColor != null) return m;
    const it = byId.get(m.id);
    if (!it?.color) return m;
    const hex = fileItemColorToMemoThemeHex(it.color);
    return hex ? { ...m, themeColor: hex } : m;
  });
}

/** Keeps at least one root node so the editor always has a body to focus under the title. */
function withAtLeastOneRootNode(nodes: NoteNode[]): NoteNode[] {
  return nodes.length === 0 ? [createNode()] : nodes;
}

const DEFAULT_MEMOS: Memo[] = [
  {
    id: DEFAULT_MEMO_ID_TRACK,
    title: "Track Memo",
    memoType: "music",
    themeColor: null,
    musicMeta: { bpm: 128, key: "D", scale: "minor", musicReleaseStatus: "DEMO" },
    gamedevMeta: null,
    nodes: [
      createNode({ id: DEF_NODE_T1, content: "Session 2026-05" }),
      createNode({ id: DEF_NODE_T2, content: "Chord ideas" }),
      createNode({ id: DEF_NODE_T3, content: "Lyrics draft" }),
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: DEFAULT_MEMO_ID_GAMEDEV,
    title: "Game Dev",
    memoType: "gamedev",
    themeColor: null,
    musicMeta: null,
    gamedevMeta: { ...DEFAULT_GAMEDEV_META },
    nodes: [
      createNode({ id: DEF_NODE_G1, content: "Mechanics overview" }),
      createNode({ id: DEF_NODE_G2, content: "World building notes" }),
    ],
    updatedAt: new Date().toISOString(),
  },
  {
    id: DEFAULT_MEMO_ID_IDEAS,
    title: "Ideas",
    memoType: "standard",
    themeColor: null,
    musicMeta: null,
    gamedevMeta: null,
    nodes: [
      createNode({ id: DEF_NODE_I1, content: "Product concepts" }),
      createNode({ id: DEF_NODE_I2, content: "Research notes" }),
    ],
    updatedAt: new Date().toISOString(),
  },
];

function normalizeGamedevMeta(raw: unknown): MemoGamedevMeta {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GAMEDEV_META };
  const r = raw as Record<string, unknown>;
  return {
    stage: normalizeGamedevStage(r.stage),
  };
}

function normalizeMemo(raw: Partial<Memo> & { nodes?: unknown }): Memo {
  const memoType = normalizeMemoType(raw.memoType);
  const musicMeta =
    memoType === "music" || raw.musicMeta != null
      ? normalizeMusicMeta(raw.musicMeta)
      : null;
  const gamedevMeta =
    memoType === "gamedev"
      ? normalizeGamedevMeta(raw.gamedevMeta)
      : null;
  return {
    id: typeof raw.id === "string" ? raw.id : newMemoUuid(),
    title: typeof raw.title === "string" ? raw.title : "Untitled Memo",
    memoType,
    themeColor: normalizeHexColorOrNull(raw.themeColor),
    musicMeta,
    gamedevMeta,
    nodes: Array.isArray(raw.nodes)
      ? raw.nodes.map((n) => normalizeNode(n as Partial<NoteNode> & { children?: unknown }))
      : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    ownerUserId: typeof raw.ownerUserId === "string" ? raw.ownerUserId : undefined,
    shareRole:
      raw.shareRole === "viewer" || raw.shareRole === "editor" ? raw.shareRole : undefined,
  };
}

function loadFromStorage(): StorageData {
  try {
    const raw = localStorage.getItem(MEMO_KEY);
    if (!raw) return { memos: DEFAULT_MEMOS, activeMemoId: DEFAULT_MEMOS[0].id };
    const parsed = JSON.parse(raw) as Partial<StorageData>;
    const memos = Array.isArray(parsed.memos)
      ? parsed.memos.map((m) => normalizeMemo(m as Partial<Memo>))
      : DEFAULT_MEMOS;
    if (memos.length === 0) return { memos: DEFAULT_MEMOS, activeMemoId: DEFAULT_MEMOS[0].id };
    const activeMemoId =
      typeof parsed.activeMemoId === "string" && memos.some((m) => m.id === parsed.activeMemoId)
        ? parsed.activeMemoId
        : memos[0].id;
    return { memos, activeMemoId };
  } catch {
    return { memos: DEFAULT_MEMOS, activeMemoId: DEFAULT_MEMOS[0].id };
  }
}

function normalizeFileItem(raw: unknown): FileItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || (r.type !== "folder" && r.type !== "memo")) return null;
  return {
    id: r.id,
    type: r.type as "folder" | "memo",
    name: typeof r.name === "string" ? r.name : "",
    parentId: typeof r.parentId === "string" ? r.parentId : null,
    isOpen: typeof r.isOpen === "boolean" ? r.isOpen : false,
    order: typeof r.order === "number" ? r.order : 0,
    isBookmarked: typeof r.isBookmarked === "boolean" ? r.isBookmarked : undefined,
    icon: typeof r.icon === "string" ? r.icon : undefined,
    memoType:
      r.type === "memo" ? normalizeMemoType(r.memoType) : undefined,
    ...(() => {
      const color = normalizeFileItemStoredColor(r.color);
      return color !== undefined ? { color } : {};
    })(),
    ...(r.type === "memo" && r.workflowStatus !== undefined && r.workflowStatus !== null
      ? { workflowStatus: normalizeMemoWorkflowStatus(r.workflowStatus) }
      : {}),
  };
}

function syncMemoTypesIntoFileItems(memos: Memo[], items: FileItem[]): FileItem[] {
  const byId = new Map(memos.map((m) => [m.id, m]));
  return items.map((it) => {
    if (it.type !== "memo") return it;
    const m = byId.get(it.id);
    return m ? { ...it, memoType: m.memoType } : it;
  });
}

function ensureFileItemsCoverMemos(memos: Memo[], items: FileItem[]): FileItem[] {
  const memoIds = new Set(items.filter((i) => i.type === "memo").map((i) => i.id));
  const maxOrder = items.reduce((max, i) => Math.max(max, i.order), 0);
  const missing: FileItem[] = memos
    .filter((m) => !memoIds.has(m.id))
    .map((m, idx) => ({
      id: m.id,
      type: "memo" as const,
      name: m.title || "Untitled Memo",
      parentId: null,
      isOpen: false,
      order: maxOrder + idx + 1,
      memoType: m.memoType,
    }));
  return missing.length > 0 ? [...items, ...missing] : items;
}

function loadFileSystem(memos: Memo[]): FileItem[] {
  const memoById = new Map(memos.map((m) => [m.id, m]));
  const syncMemoRow = (it: FileItem): FileItem => {
    if (it.type !== "memo") return it;
    const m = memoById.get(it.id);
    return { ...it, memoType: m?.memoType ?? it.memoType ?? "standard" };
  };

  try {
    const raw = localStorage.getItem(FS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown[];
      const items = parsed.map(normalizeFileItem).filter(Boolean) as FileItem[];
      const synced = items.map(syncMemoRow);
      const memoIds = new Set(synced.filter((i) => i.type === "memo").map((i) => i.id));
      const maxOrder = synced.reduce((max, i) => Math.max(max, i.order), 0);
      const missing: FileItem[] = memos
        .filter((m) => !memoIds.has(m.id))
        .map((m, idx) => ({
          id: m.id,
          type: "memo" as const,
          name: m.title || "Untitled Memo",
          parentId: null,
          isOpen: false,
          order: maxOrder + idx + 1,
          memoType: m.memoType,
        }));
      return [...synced, ...missing];
    }
  } catch { /* fallthrough */ }
  return memos.map((m, idx) => ({
    id: m.id,
    type: "memo" as const,
    name: m.title || "Untitled Memo",
    parentId: null,
    isOpen: false,
    order: idx,
    memoType: m.memoType,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>(DEFAULT_MEMOS);
  const [activeMemoId, setActiveMemoId] = useState<string>(DEFAULT_MEMOS[0].id);
  const [fileItems, setFileItems] = useState<FileItem[]>(() =>
    DEFAULT_MEMOS.map((m, idx) => ({
      id: m.id,
      type: "memo" as const,
      name: m.title,
      parentId: null,
      isOpen: false,
      order: idx,
      memoType: m.memoType,
    })),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  const { user, loading: authLoading, configured } = useAuth();
  const [cloudPhase, setCloudPhase] = useState<"idle" | "loading" | "saving" | "saved" | "error">(
    "idle",
  );
  const [cloudMessage, setCloudMessage] = useState<string | undefined>();
  const [cloudReady, setCloudReady] = useState(false);
  const lastCloudFingerprintRef = useRef<Map<string, string>>(new Map());
  const lastCloudFolderFingerprintRef = useRef<string>("");
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memosRef = useRef(memos);
  memosRef.current = memos;
  const activeMemoIdRef = useRef(activeMemoId);
  activeMemoIdRef.current = activeMemoId;
  const fileItemsRef = useRef(fileItems);
  fileItemsRef.current = fileItems;

  /** Stable while memo ids / owners unchanged — avoids re-pinning on every body edit. */
  const sharePlacementOwnerKey = memos.map((m) => `${m.id}:${m.ownerUserId ?? ""}`).join("|");

  // ── History (full memo workspace: nodes, theme, meta, linked FileItem row) ──
  const historyRef = useRef<Map<string, HistoryStack<MemoWorkspaceSnapshot<Memo>>>>(new Map());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const textSessionSnapshotRef = useRef<MemoWorkspaceSnapshot<Memo> | null>(null);
  const textSessionMemoIdRef = useRef<string | null>(null);
  const colorSliderSnapshotRef = useRef<MemoWorkspaceSnapshot<Memo> | null>(null);
  const colorSliderMemoIdRef = useRef<string | null>(null);

  const getStack = useCallback((id: string): HistoryStack<MemoWorkspaceSnapshot<Memo>> => {
    if (!historyRef.current.has(id)) {
      historyRef.current.set(id, createStack<MemoWorkspaceSnapshot<Memo>>());
    }
    return historyRef.current.get(id)!;
  }, []);

  const syncHistoryState = useCallback((id: string) => {
    const s = getStack(id);
    setCanUndo(s.past.length > 0);
    setCanRedo(s.future.length > 0);
  }, [getStack]);

  useEffect(() => {
    syncHistoryState(activeMemoId);
  }, [activeMemoId, syncHistoryState]);

  const endTextUndoSession = useCallback(() => {
    const snap = textSessionSnapshotRef.current;
    const mid = textSessionMemoIdRef.current;
    textSessionSnapshotRef.current = null;
    textSessionMemoIdRef.current = null;
    if (!snap || !mid) return;
    if (mid !== activeMemoIdRef.current) return;
    const now = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, mid);
    if (!now || workspaceSnapshotsEqual(snap, now)) return;
    historyRef.current.set(mid, stackRecord(getStack(mid), snap));
    syncHistoryState(mid);
  }, [getStack, syncHistoryState]);

  const beginMemoTextUndoSession = useCallback(() => {
    endTextUndoSession();
    const id = activeMemoIdRef.current;
    const snap = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, id);
    if (!snap) return;
    textSessionSnapshotRef.current = snap;
    textSessionMemoIdRef.current = id;
  }, [endTextUndoSession]);

  const endMemoColorSliderUndoGesture = useCallback(() => {
    const snap = colorSliderSnapshotRef.current;
    const mid = colorSliderMemoIdRef.current;
    colorSliderSnapshotRef.current = null;
    colorSliderMemoIdRef.current = null;
    if (!snap || !mid) return;
    if (mid !== activeMemoIdRef.current) return;
    const now = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, mid);
    if (!now || workspaceSnapshotsEqual(snap, now)) return;
    historyRef.current.set(mid, stackRecord(getStack(mid), snap));
    syncHistoryState(mid);
  }, [getStack, syncHistoryState]);

  const beginMemoColorSliderUndoGesture = useCallback(() => {
    endMemoColorSliderUndoGesture();
    endTextUndoSession();
    const id = activeMemoIdRef.current;
    const snap = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, id);
    if (!snap) return;
    colorSliderSnapshotRef.current = snap;
    colorSliderMemoIdRef.current = id;
  }, [endTextUndoSession, endMemoColorSliderUndoGesture]);

  const recordBeforeMutation = useCallback(() => {
    const id = activeMemoIdRef.current;
    endTextUndoSession();
    endMemoColorSliderUndoGesture();
    const snap = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, id);
    if (!snap) return;
    historyRef.current.set(id, stackRecord(getStack(id), snap));
    syncHistoryState(id);
  }, [getStack, syncHistoryState, endTextUndoSession, endMemoColorSliderUndoGesture]);

  // ── Hydrate from localStorage ─────────────────────────────────────────────
  useEffect(() => {
    const memoData = loadFromStorage();
    let memosNext = memoData.memos.map((m) => normalizeMemo(m as Partial<Memo>));
    let fsData = loadFileSystem(memosNext);
    let activeId = memoData.activeMemoId;
    const remapped = remapInvalidMemoIds(memosNext, fsData, activeId);
    if (remapped) {
      memosNext = remapped.memos;
      fsData = remapped.fileItems;
      activeId = remapped.activeMemoId;
    }
    setMemos(mergeMemosThemeFromSidebarLabels(memosNext, fsData));
    setActiveMemoId(activeId);
    setFileItems(fsData);
    setIsHydrated(true);
  }, []);

  // ── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(
      MEMO_KEY,
      JSON.stringify({ memos: memosRef.current, activeMemoId: activeMemoIdRef.current }),
    );
  }, [memos, activeMemoId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(FS_KEY, JSON.stringify(fileItemsRef.current));
  }, [fileItems, isHydrated]);

  // Pin invitee shared memos under "Shared with me" / lift owned orphans to root
  useEffect(() => {
    if (!isHydrated || !user?.id) return;
    setFileItems((prev) =>
      normalizeSharedMemoSidebarPlacement(prev, memosRef.current, user.id),
    );
  }, [isHydrated, user?.id, sharePlacementOwnerKey]);

  // ── Supabase: pull on login, push new account data once, then debounced saves ─
  useEffect(() => {
    if (!isHydrated || !configured || authLoading) return;
    const client = getSupabaseBrowserClient();
    if (!user || !client) {
      setCloudReady(false);
      setCloudPhase("idle");
      setCloudMessage(undefined);
      lastCloudFingerprintRef.current.clear();
      lastCloudFolderFingerprintRef.current = "";
      return;
    }

    let cancelled = false;
    setCloudReady(false);
    setCloudMessage(undefined);
    setCloudPhase("loading");

    void (async () => {
      try {
        const rows = await fetchUserMemos(client, user.id, user.email ?? null);
        if (cancelled) return;

        if (rows.length > 0) {
          const roleMap = await fetchInviteeShareRolesByMemoId(client, user.email ?? null);
          let sharedOrder = 0;
          const memosFromCloud = rows.map((r) => {
            const base = memoRowToMemo(r);
            const isOwned = r.user_id === user.id;
            return {
              ...base,
              shareRole: isOwned ? undefined : (roleMap.get(r.id) ?? "viewer"),
            };
          });
          console.log("Fetched memos:", memosFromCloud);
          const itemsFromCloud = rows.map((r, i) => {
            const isShared = r.user_id !== user.id;
            return fileItemFromRow(memosFromCloud[i]!, r, {
              sharedWithMe: isShared,
              sharedOrder: isShared ? sharedOrder++ : undefined,
            });
          });

          let foldersFromCloud: FileItem[] = [];
          try {
            const folderRows = await fetchUserFolders(client, user.id);
            foldersFromCloud = folderRows.map(folderRowToFileItem);
          } catch (folderErr) {
            console.warn("[freavia] freavia_folders fetch failed — run DB migration?", folderErr);
          }

          const localFolderItems = fileItemsRef.current.filter((i) => i.type === "folder");
          const folderItems =
            foldersFromCloud.length > 0 ? foldersFromCloud : localFolderItems;

          const mergedFileItems = normalizeSharedMemoSidebarPlacement(
            [...folderItems, ...itemsFromCloud],
            memosFromCloud,
            user.id,
          );

          lastCloudFingerprintRef.current.clear();
          for (const m of memosFromCloud) {
            const it = mergedFileItems.find((i) => i.id === m.id && i.type === "memo");
            lastCloudFingerprintRef.current.set(m.id, cloudMemoFingerprint(m, it));
          }
          lastCloudFolderFingerprintRef.current = cloudFoldersFingerprint(folderItems);

          historyRef.current = new Map();
          setCanUndo(false);
          setCanRedo(false);
          setMemos(mergeMemosThemeFromSidebarLabels(memosFromCloud, mergedFileItems));
          setFileItems(mergedFileItems);
          setActiveMemoId((prev) =>
            memosFromCloud.some((m) => m.id === prev) ? prev : memosFromCloud[0]!.id,
          );
        } else {
          const ms = memosRef.current;
          const fis = fileItemsRef.current;
          lastCloudFingerprintRef.current.clear();
          for (const m of ms) {
            if (!isUuid(m.id)) continue;
            const it = fis.find((i) => i.id === m.id && i.type === "memo");
            await insertMemoRow(client, user.id, m, it);
            lastCloudFingerprintRef.current.set(m.id, cloudMemoFingerprint(m, it));
          }
          const localFolders = fis.filter((i) => i.type === "folder");
          try {
            await replaceUserFolders(client, user.id, localFolders);
            lastCloudFolderFingerprintRef.current = cloudFoldersFingerprint(localFolders);
          } catch (folderErr) {
            console.warn("[freavia] freavia_folders bootstrap failed — run DB migration?", folderErr);
          }
        }

        if (!cancelled) {
          setCloudReady(true);
          setCloudPhase("idle");
        }
      } catch (e) {
        if (cancelled) return;
        logFreaviaCloudError("[useMemos] initial cloud sync failed", e);
        setCloudPhase("error");
        setCloudMessage(cloudErrorUserMessage(e, "Sync failed"));
        setCloudReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, configured, authLoading, user?.id, user?.email]);

  useEffect(() => {
    if (!isHydrated || !cloudReady || !user) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      saveDebounceRef.current = null;
      void (async () => {
        setCloudPhase("saving");
        setCloudMessage(undefined);
        try {
          for (const m of memosRef.current) {
            if (!isUuid(m.id)) continue;
            if (isMemoReadOnlyForCurrentUser(m, user.id)) continue;
            const it = fileItemsRef.current.find((i) => i.id === m.id && i.type === "memo");
            const fp = cloudMemoFingerprint(m, it);
            if (lastCloudFingerprintRef.current.get(m.id) === fp) continue;
            await upsertMemoRow(client, user.id, m, it);
            lastCloudFingerprintRef.current.set(m.id, fp);
          }

          const folderItems = fileItemsRef.current.filter((i) => i.type === "folder");
          const folderFp = cloudFoldersFingerprint(folderItems);
          if (lastCloudFolderFingerprintRef.current !== folderFp) {
            await replaceUserFolders(client, user.id, folderItems);
            lastCloudFolderFingerprintRef.current = folderFp;
          }

          setCloudPhase("saved");
          window.setTimeout(() => {
            setCloudPhase((p) => (p === "saved" ? "idle" : p));
          }, 1400);
        } catch (e) {
          logFreaviaCloudError("[useMemos] debounced cloud save failed", e);
          setCloudPhase("error");
          setCloudMessage(cloudErrorUserMessage(e, "Save failed"));
        }
      })();
    }, 2200);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = null;
      }
    };
  }, [memos, fileItems, isHydrated, cloudReady, user?.id, activeMemoId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const activeMemo = memos.find((m) => m.id === activeMemoId) ?? memos[0];
  const activeMemoReadOnly = useMemo(
    () => isMemoReadOnlyForCurrentUser(activeMemo, user?.id ?? null),
    [activeMemo, user?.id],
  );

  const focusNode = useCallback((nodeId: string) => {
    const root = document.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!root) return;
    const cardName = root.querySelector<HTMLElement>('[data-card-focus-target="name"]');
    if (cardName) {
      cardName.focus();
      if (cardName instanceof HTMLInputElement) {
        const len = cardName.value.length;
        cardName.setSelectionRange(len, len);
      }
      return;
    }
    const el = root.querySelector<HTMLElement>(`[data-geo-editor="body"]`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, []);

  /** After DOM paints a newly inserted node, move caret into its body editor. */
  const focusNodeAfterCommit = useCallback(
    (nodeId: string) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => focusNode(nodeId));
      });
    },
    [focusNode],
  );

  /** Repair memos that have no body nodes (deleted / bad import) so the editor is never stuck. */
  useEffect(() => {
    if (!isHydrated) return;
    const id = activeMemoIdRef.current;
    const m = memosRef.current.find((x) => x.id === id);
    if (!m || m.nodes.length > 0) return;
    if (isMemoReadOnlyForCurrentUser(m, user?.id ?? null)) return;
    const filler = createNode();
    setMemos((prev) =>
      prev.map((mm) =>
        mm.id === id ? { ...mm, nodes: [filler], updatedAt: new Date().toISOString() } : mm,
      ),
    );
    focusNodeAfterCommit(filler.id);
  }, [isHydrated, activeMemoId, memos, focusNodeAfterCommit, user?.id]);

  const nextOrder = useCallback((parentId: string | null) => {
    const siblings = fileItemsRef.current.filter((i) => i.parentId === parentId);
    return siblings.reduce((max, i) => Math.max(max, i.order), -1) + 1;
  }, []);

  // ── updateActiveNodes (core node mutation + history) ─────────────────────
  const updateActiveNodes = useCallback(
    (
      updater: (nodes: NoteNode[]) => NoteNode[],
      historyMode: "immediate" | "none" = "immediate",
    ) => {
      const id = activeMemoIdRef.current;

      if (historyMode === "immediate") {
        recordBeforeMutation();
      }

      setMemos((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, nodes: updater(m.nodes), updatedAt: new Date().toISOString() } : m,
        ),
      );
    },
    [recordBeforeMutation],
  );

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    endTextUndoSession();
    endMemoColorSliderUndoGesture();
    const id = activeMemoIdRef.current;
    const current = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, id);
    if (!current) return;
    const result = stackUndo(getStack(id), current);
    if (!result) return;
    historyRef.current.set(id, result.next);
    const restored = result.restored;
    const memo = { ...restored.memo, nodes: withAtLeastOneRootNode(restored.memo.nodes) };
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...memo, updatedAt: new Date().toISOString() } : m)),
    );
    if (restored.fileItem) {
      const fi = restored.fileItem;
      setFileItems((prev) => prev.map((f) => (f.id === fi.id ? { ...fi } : f)));
    }
    syncHistoryState(id);
    if (memo.nodes.length === 1 && restored.memo.nodes.length === 0) {
      focusNodeAfterCommit(memo.nodes[0]!.id);
    }
  }, [getStack, syncHistoryState, endTextUndoSession, endMemoColorSliderUndoGesture, focusNodeAfterCommit]);

  const redo = useCallback(() => {
    endTextUndoSession();
    endMemoColorSliderUndoGesture();
    const id = activeMemoIdRef.current;
    const current = cloneWorkspaceSnapshot(memosRef.current, fileItemsRef.current, id);
    if (!current) return;
    const result = stackRedo(getStack(id), current);
    if (!result) return;
    historyRef.current.set(id, result.next);
    const restored = result.restored;
    const memo = { ...restored.memo, nodes: withAtLeastOneRootNode(restored.memo.nodes) };
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...memo, updatedAt: new Date().toISOString() } : m)),
    );
    if (restored.fileItem) {
      const fi = restored.fileItem;
      setFileItems((prev) => prev.map((f) => (f.id === fi.id ? { ...fi } : f)));
    }
    syncHistoryState(id);
    if (memo.nodes.length === 1 && restored.memo.nodes.length === 0) {
      focusNodeAfterCommit(memo.nodes[0]!.id);
    }
  }, [getStack, syncHistoryState, endTextUndoSession, endMemoColorSliderUndoGesture, focusNodeAfterCommit]);

  // ── Memo management ───────────────────────────────────────────────────────
  const switchMemo = useCallback(
    (id: string) => {
      endTextUndoSession();
      endMemoColorSliderUndoGesture();
      setActiveMemoId(id);
    },
    [endTextUndoSession, endMemoColorSliderUndoGesture],
  );

  /** Create a new memo, optionally inside a folder. */
  const addMemo = useCallback(
    (parentId: string | null = null, kind: MemoType = "standard"): string => {
      endTextUndoSession();
      endMemoColorSliderUndoGesture();
      const musicMeta = kind === "music" ? { ...DEFAULT_MUSIC_META } : null;
      const gamedevMeta = kind === "gamedev" ? { ...DEFAULT_GAMEDEV_META } : null;
      const newMemo: Memo = {
        id: newMemoUuid(),
        title: "",
        memoType: kind,
        themeColor: null,
        musicMeta,
        gamedevMeta,
        nodes: [createNode()],
        updatedAt: new Date().toISOString(),
      };
      const newItem: FileItem = {
        id: newMemo.id,
        type: "memo",
        name: "",
        parentId,
        isOpen: false,
        order: nextOrder(parentId),
        memoType: kind,
        workflowStatus: "DRAFT",
      };
      setMemos((prev) => [...prev, newMemo]);
      setFileItems((prev) => [...prev, newItem]);
      setActiveMemoId(newMemo.id);

      const client = getSupabaseBrowserClient();
      if (cloudReady && user && client) {
        void insertMemoRow(client, user.id, newMemo, newItem)
          .then(() => {
            lastCloudFingerprintRef.current.set(
              newMemo.id,
              cloudMemoFingerprint(newMemo, newItem),
            );
          })
          .catch((e) => {
            logFreaviaCloudError("[useMemos] insertMemoRow (create) failed", e);
            setCloudPhase("error");
            setCloudMessage(cloudErrorUserMessage(e, "Create failed"));
          });
      }
      return newMemo.id;
    },
    [nextOrder, endTextUndoSession, endMemoColorSliderUndoGesture, cloudReady, user],
  );

  const setMemoType = useCallback(
    (memoId: string, next: MemoType) => {
      if (memoId === activeMemoIdRef.current) recordBeforeMutation();
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== memoId) return m;
          const musicMeta =
            next === "music"
              ? (m.musicMeta ? { ...m.musicMeta } : { ...DEFAULT_MUSIC_META })
              : next === "standard"
                ? (m.musicMeta ? { ...m.musicMeta } : null)
                : null;
          const gamedevMeta =
            next === "gamedev"
              ? (m.gamedevMeta ? { ...m.gamedevMeta } : { ...DEFAULT_GAMEDEV_META })
              : null;
          return { ...m, memoType: next, musicMeta, gamedevMeta, updatedAt: new Date().toISOString() };
        }),
      );
      setFileItems((prev) =>
        prev.map((it) => (it.id === memoId && it.type === "memo" ? { ...it, memoType: next } : it)),
      );
    },
    [recordBeforeMutation],
  );

  const patchActiveMusicMeta = useCallback(
    (patch: Partial<MemoMusicMeta>) => {
      recordBeforeMutation();
      const id = activeMemoIdRef.current;
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== id || !m.musicMeta) return m;
          const nextMeta = { ...m.musicMeta };
          if (patch.bpm !== undefined) nextMeta.bpm = clampBpm(patch.bpm);
          if (patch.key !== undefined) nextMeta.key = normalizeMusicKey(patch.key);
          if (patch.scale !== undefined) nextMeta.scale = normalizeMusicScale(patch.scale);
          if (patch.musicReleaseStatus !== undefined) {
            nextMeta.musicReleaseStatus = normalizeMusicReleaseStatus(patch.musicReleaseStatus);
          }
          return { ...m, musicMeta: nextMeta, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [recordBeforeMutation],
  );

  const initMusicModuleForMemo = useCallback((memoId: string) => {
    setMemos((prev) =>
      prev.map((m) => {
        if (m.id !== memoId || m.musicMeta !== null) return m;
        return { ...m, musicMeta: { ...DEFAULT_MUSIC_META } };
      }),
    );
  }, []);

  const patchActiveGamedevMeta = useCallback(
    (patch: Partial<MemoGamedevMeta>) => {
      recordBeforeMutation();
      const id = activeMemoIdRef.current;
      setMemos((prev) =>
        prev.map((m) => {
          if (m.id !== id || m.memoType !== "gamedev") return m;
          const base = m.gamedevMeta ?? { ...DEFAULT_GAMEDEV_META };
          const nextMeta = { ...base };
          if (patch.stage !== undefined) nextMeta.stage = normalizeGamedevStage(patch.stage);
          return { ...m, gamedevMeta: nextMeta, updatedAt: new Date().toISOString() };
        }),
      );
    },
    [recordBeforeMutation],
  );

  const updateMemoTitle = useCallback((title: string) => {
    const id = activeMemoIdRef.current;
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, title, updatedAt: new Date().toISOString() } : m)),
    );
    setFileItems((prev) => prev.map((item) => (item.id === id ? { ...item, name: title } : item)));
  }, []);

  // ── File-system operations ────────────────────────────────────────────────
  const addFolder = useCallback((parentId: string | null, name: string) => {
    const newFolder: FileItem = {
      id: newFolderId(),
      type: "folder",
      name: name.trim() || "New Folder",
      parentId,
      isOpen: true,
      order: nextOrder(parentId),
    };
    setFileItems((prev) => [...prev, newFolder]);
  }, [nextOrder]);

  // ── Memo-specific FS operations ──────────────────────────────────────────

  const setMemoWorkflowStatus = useCallback(
    (memoId: string, status: MemoWorkflowStatus) => {
      if (memoId === activeMemoIdRef.current) recordBeforeMutation();
      setFileItems((prev) =>
        prev.map((i) => (i.id === memoId && i.type === "memo" ? { ...i, workflowStatus: status } : i)),
      );
    },
    [recordBeforeMutation],
  );

  /** Deep-copy a memo's node tree, assigning fresh IDs throughout. */
  const copyNodes = (nodes: NoteNode[]): NoteNode[] =>
    nodes.map((n) => ({ ...n, id: makeId(), children: copyNodes(n.children) }));

  /** Duplicate a memo: deep-copy content + create sibling FileItem. */
  const duplicateMemo = useCallback(
    (memoId: string) => {
      endTextUndoSession();
      endMemoColorSliderUndoGesture();
      const src = memosRef.current.find((m) => m.id === memoId);
      const srcItem = fileItemsRef.current.find((i) => i.id === memoId);
      if (!src || !srcItem) return;

      const newId = newMemoUuid();
      const newMemo: Memo = {
        ...src,
        id: newId,
        title: src.title ? `${src.title} (Copy)` : "Untitled (Copy)",
        memoType: src.memoType,
        musicMeta: src.musicMeta ? { ...src.musicMeta } : null,
        nodes: copyNodes(src.nodes),
        updatedAt: new Date().toISOString(),
      };
      const newItem: FileItem = {
        ...srcItem,
        id: newId,
        name: newMemo.title,
        isBookmarked: false,
        order: nextOrder(srcItem.parentId),
        memoType: src.memoType,
      };

      setMemos((prev) => [...prev, newMemo]);
      setFileItems((prev) => [...prev, newItem]);
      setActiveMemoId(newId);

      const client = getSupabaseBrowserClient();
      if (cloudReady && user && client) {
        void insertMemoRow(client, user.id, newMemo, newItem)
          .then(() => {
            lastCloudFingerprintRef.current.set(
              newMemo.id,
              cloudMemoFingerprint(newMemo, newItem),
            );
          })
          .catch((e) => {
            logFreaviaCloudError("[useMemos] insertMemoRow (duplicate) failed", e);
            setCloudPhase("error");
            setCloudMessage(cloudErrorUserMessage(e, "Duplicate failed"));
          });
      }
    },
    [nextOrder, endTextUndoSession, endMemoColorSliderUndoGesture, cloudReady, user],
  );

  /** Toggle the bookmark star on any FileItem. */
  const toggleBookmark = useCallback(
    (itemId: string) => {
      if (itemId === activeMemoIdRef.current) recordBeforeMutation();
      setFileItems((prev) => {
        const target = prev.find((i) => i.id === itemId);
        if (!target) return prev;

        const willBookmark = !target.isBookmarked;

        if (!willBookmark) {
          return prev.map((i) => (i.id === itemId ? { ...i, isBookmarked: false } : i));
        }

        const getDescendantIds = (id: string): Set<string> => {
          const result = new Set<string>();
          const queue = [id];
          while (queue.length) {
            const cur = queue.pop()!;
            prev.filter((i) => i.parentId === cur).forEach((child) => {
              result.add(child.id);
              queue.push(child.id);
            });
          }
          return result;
        };
        const descendants = getDescendantIds(itemId);

        return prev.map((i) => {
          if (i.id === itemId) return { ...i, isBookmarked: true };
          if (descendants.has(i.id)) return { ...i, isBookmarked: false };
          return i;
        });
      });
    },
    [recordBeforeMutation],
  );

  /** Set a custom emoji icon on any file item. */
  const setItemIcon = useCallback(
    (itemId: string, icon: string) => {
      if (itemId === activeMemoIdRef.current) recordBeforeMutation();
      setFileItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, icon: icon || undefined } : item,
        ),
      );
    },
    [recordBeforeMutation],
  );

  const setItemColor = useCallback(
    (
      itemId: string,
      color: FileItemColor | FileItemLabelColor | null,
      opts?: { skipHistory?: boolean },
    ) => {
      const wasMemo = fileItemsRef.current.find((i) => i.id === itemId)?.type === "memo";
      const shouldRecord =
        wasMemo &&
        itemId === activeMemoIdRef.current &&
        !opts?.skipHistory;
      if (shouldRecord) recordBeforeMutation();
      setFileItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          if (color == null || color === "default") {
            const { color: _c, ...rest } = item;
            return rest;
          }
          return { ...item, color };
        }),
      );
      if (wasMemo) {
        const themeHex =
          color == null || color === "default" ? null : fileItemColorToMemoThemeHex(color);
        setMemos((prev) =>
          prev.map((m) =>
            m.id === itemId
              ? { ...m, themeColor: themeHex, updatedAt: new Date().toISOString() }
              : m,
          ),
        );
      }
    },
    [recordBeforeMutation],
  );

  /** Export a memo as a JSON file download. */
  const exportMemo = useCallback((memoId: string) => {
    const memo = memosRef.current.find((m) => m.id === memoId);
    if (!memo) return;
    const json = JSON.stringify(memo, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${memo.title || "untitled"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setFileItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isOpen: !item.isOpen } : item)),
    );
  }, []);

  /** Open every ancestor folder in the sidebar so `itemId` is visible in the tree. */
  const expandFoldersToRevealItem = useCallback((itemId: string) => {
    setFileItems((prev) => {
      const byId = new Map(prev.map((i) => [i.id, i]));
      let cur = byId.get(itemId);
      const folderIds = new Set<string>();
      while (cur?.parentId) {
        const p = byId.get(cur.parentId);
        if (p?.type === "folder") folderIds.add(p.id);
        cur = p;
      }
      if (folderIds.size === 0) return prev;
      return prev.map((i) => (folderIds.has(i.id) ? { ...i, isOpen: true } : i));
    });
  }, []);

  const ensureFolderOpen = useCallback((folderId: string) => {
    setFileItems((prev) =>
      prev.map((item) =>
        item.id === folderId && item.type === "folder" ? { ...item, isOpen: true } : item,
      ),
    );
  }, []);

  /** Expand collapsed node ancestors so `nodeId` is visible (any memo, not only active). */
  const expandNodePathInMemo = useCallback(
    (memoId: string, nodeId: string) => {
      if (memoId === activeMemoIdRef.current) recordBeforeMutation();
      setMemos((prev) => {
        const m = prev.find((x) => x.id === memoId);
        if (!m) return prev;
        const path = findNodePath(m.nodes, nodeId);
        if (!path) return prev;
        const toExpand = new Set(path.slice(0, -1).map((n) => n.id));
        if (toExpand.size === 0) return prev;
        const newNodes = mapTree(m.nodes, (n) =>
          toExpand.has(n.id) && n.collapsed ? { ...n, collapsed: false } : n,
        );
        return prev.map((mm) =>
          mm.id === memoId ? { ...mm, nodes: newNodes, updatedAt: new Date().toISOString() } : mm,
        );
      });
    },
    [recordBeforeMutation],
  );

  const renameItem = useCallback(
    (id: string, name: string) => {
      const item = fileItemsRef.current.find((i) => i.id === id);
      if (item?.type === "memo" && id === activeMemoIdRef.current) recordBeforeMutation();
      setFileItems((prev) => prev.map((it) => (it.id === id ? { ...it, name } : it)));
      if (item?.type === "memo") {
        setMemos((prev) => prev.map((m) => (m.id === id ? { ...m, title: name } : m)));
      }
    },
    [recordBeforeMutation],
  );

  /**
   * Move or reorder an item via drag-and-drop.
   *
   * @param draggedId      – item being moved
   * @param targetParentId – destination parent (null = root, or a folder id)
   * @param insertBeforeId – if provided, insert before this sibling; null = append at end
   *
   * Safety: blocks self-drops and circular folder moves.
   */
  const moveItem = useCallback(
    (draggedId: string, targetParentId: string | null, insertBeforeId?: string | null) => {
      setFileItems((prev) => {
        if (draggedId === targetParentId) return prev;

        // Circular reference guard (folder into its own descendant)
        if (targetParentId !== null) {
          const isDescendant = (checkId: string, ancestorId: string): boolean => {
            if (checkId === ancestorId) return true;
            const item = prev.find((i) => i.id === checkId);
            if (!item || item.parentId === null) return false;
            return isDescendant(item.parentId, ancestorId);
          };
          if (isDescendant(targetParentId, draggedId)) return prev;
        }

        const dragged = prev.find((i) => i.id === draggedId);
        if (!dragged) return prev;

        // Build the ordered sibling list for the target parent, excluding dragged item
        const siblings = prev
          .filter((i) => i.parentId === targetParentId && i.id !== draggedId)
          .sort((a, b) => a.order - b.order);

        // Find insertion index
        let insertIdx = siblings.length; // default: append
        if (insertBeforeId) {
          const idx = siblings.findIndex((i) => i.id === insertBeforeId);
          if (idx !== -1) insertIdx = idx;
        }

        // Inject dragged item at the right position
        siblings.splice(insertIdx, 0, { ...dragged, parentId: targetParentId });

        // Normalize orders for all affected siblings (multiples of 10 for headroom)
        const orderMap = new Map(siblings.map((item, i) => [item.id, i * 10]));

        return prev.map((item) => {
          if (item.id === draggedId) {
            return { ...item, parentId: targetParentId, order: orderMap.get(item.id)! };
          }
          if (orderMap.has(item.id)) {
            return { ...item, order: orderMap.get(item.id)! };
          }
          return item;
        });
      });
    },
    [],
  );

  /**
   * Batch move/reorder — same rules as {@link moveItem}, preserves order of `draggedIds`
   * when inserting (caller should pass ids in visual order).
   */
  const moveItems = useCallback(
    (draggedIds: string[], targetParentId: string | null, insertBeforeId?: string | null) => {
      const orderedUnique: string[] = [];
      const seen = new Set<string>();
      for (const id of draggedIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        orderedUnique.push(id);
      }
      if (orderedUnique.length === 0) return;

      setFileItems((prev) => {
        const idSet = new Set(orderedUnique);

        if (targetParentId !== null && idSet.has(targetParentId)) return prev;

        const isDescendantOf = (checkId: string, ancestorId: string): boolean => {
          if (checkId === ancestorId) return true;
          const item = prev.find((i) => i.id === checkId);
          if (!item || item.parentId === null) return false;
          return isDescendantOf(item.parentId, ancestorId);
        };

        if (targetParentId !== null) {
          for (const did of orderedUnique) {
            const d = prev.find((i) => i.id === did);
            if (d?.type === "folder" && isDescendantOf(targetParentId, did)) return prev;
            if (isDescendantOf(targetParentId, did)) return prev;
          }
        }

        for (const did of orderedUnique) {
          if (!prev.find((i) => i.id === did)) return prev;
        }

        const draggedItems = orderedUnique.map((id) => prev.find((i) => i.id === id)!);

        const siblings = prev
          .filter((i) => i.parentId === targetParentId && !idSet.has(i.id))
          .sort((a, b) => a.order - b.order);

        let insertIdx = siblings.length;
        if (insertBeforeId) {
          const idx = siblings.findIndex((i) => i.id === insertBeforeId);
          if (idx !== -1) insertIdx = idx;
        }

        const reparented = draggedItems.map((it) => ({ ...it, parentId: targetParentId }));
        const newSiblings = [...siblings];
        newSiblings.splice(insertIdx, 0, ...reparented);

        const orderMap = new Map(newSiblings.map((item, i) => [item.id, i * 10]));

        return prev.map((item) => {
          if (idSet.has(item.id)) {
            return { ...item, parentId: targetParentId, order: orderMap.get(item.id)! };
          }
          if (orderMap.has(item.id)) {
            return { ...item, order: orderMap.get(item.id)! };
          }
          return item;
        });
      });
    },
    [],
  );

  const deleteFileItem = useCallback((id: string) => {
    // Recursively collect all descendant IDs to delete
    const collectIds = (parentId: string): string[] => {
      const children = fileItemsRef.current.filter((i) => i.parentId === parentId);
      return [parentId, ...children.flatMap((c) => collectIds(c.id))];
    };
    const idsToDelete = new Set(collectIds(id));
    const memoIdsToDelete = new Set(
      fileItemsRef.current.filter((i) => i.type === "memo" && idsToDelete.has(i.id)).map((i) => i.id),
    );

    const client = getSupabaseBrowserClient();
    if (cloudReady && user && client) {
      for (const mid of memoIdsToDelete) {
        if (!isUuid(mid)) continue;
        lastCloudFingerprintRef.current.delete(mid);
        void deleteMemoRow(client, mid).catch((e) => {
          logFreaviaCloudError(`[useMemos] deleteMemoRow failed memoId=${mid}`, e);
          setCloudPhase("error");
          setCloudMessage(cloudErrorUserMessage(e, "Delete failed"));
        });
      }
    }

    setFileItems((prev) => prev.filter((item) => !idsToDelete.has(item.id)));
    setMemos((prev) => prev.filter((m) => !memoIdsToDelete.has(m.id)));
    // If active memo was deleted, switch to the first remaining memo
    if (memoIdsToDelete.has(activeMemoIdRef.current)) {
      const remaining = memosRef.current.filter((m) => !memoIdsToDelete.has(m.id));
      if (remaining.length > 0) setActiveMemoId(remaining[0].id);
    }
  }, [cloudReady, user]);

  // ── Node operations ───────────────────────────────────────────────────────
  const setNodeContent = useCallback(
    (nodeId: string, content: string) =>
      updateActiveNodes(
        (nodes) => mapTree(nodes, (n) => (n.id === nodeId ? { ...n, content } : n)),
        "none",
      ),
    [updateActiveNodes],
  );

  const toggleCollapsed = useCallback(
    (nodeId: string) =>
      updateActiveNodes(
        (nodes) => mapTree(nodes, (n) => (n.id === nodeId ? { ...n, collapsed: !n.collapsed } : n)),
        "immediate",
      ),
    [updateActiveNodes],
  );

  const addChild = useCallback(
    (nodeId: string) =>
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) =>
            n.id === nodeId ? { ...n, collapsed: false, children: [...n.children, createNode()] } : n,
          ),
        "immediate",
      ),
    [updateActiveNodes],
  );

  const addSibling = useCallback(
    (nodeId: string) => {
      const newNode = createNode();
      updateActiveNodes((nodes) => {
        const insert = (list: NoteNode[]): NoteNode[] => {
          const idx = list.findIndex((n) => n.id === nodeId);
          if (idx !== -1) return [...list.slice(0, idx + 1), newNode, ...list.slice(idx + 1)];
          return list.map((n) => ({ ...n, children: insert(n.children) }));
        };
        return insert(nodes);
      }, "immediate");
      focusNodeAfterCommit(newNode.id);
    },
    [updateActiveNodes, focusNodeAfterCommit],
  );

  /** Insert a sibling after `afterNodeId` with plain text converted to minimal HTML (lines → &lt;br&gt;). */
  const insertSiblingWithPlainTextAfter = useCallback(
    (afterNodeId: string, plainText: string) => {
      const escapedLines = plainText.split(/\n/).map((line) =>
        line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;"),
      );
      const html = escapedLines.join("<br>");
      const newNode = createNode({ content: html });
      updateActiveNodes((nodes) => {
        const insert = (list: NoteNode[]): NoteNode[] => {
          const idx = list.findIndex((n) => n.id === afterNodeId);
          if (idx !== -1) return [...list.slice(0, idx + 1), newNode, ...list.slice(idx + 1)];
          return list.map((n) => ({ ...n, children: insert(n.children) }));
        };
        return insert(nodes);
      }, "immediate");
      focusNodeAfterCommit(newNode.id);
    },
    [updateActiveNodes, focusNodeAfterCommit],
  );

  const addRootNode = useCallback(() => {
    const newNode = createNode();
    updateActiveNodes((nodes) => [newNode, ...nodes], "immediate");
    focusNodeAfterCommit(newNode.id);
  }, [updateActiveNodes, focusNodeAfterCommit]);

  const removeNode = useCallback(
    (nodeId: string) => {
      let insertedId: string | null = null;
      updateActiveNodes((nodes) => {
        const remove = (list: NoteNode[]): NoteNode[] =>
          list.filter((n) => n.id !== nodeId).map((n) => ({ ...n, children: remove(n.children) }));
        const next = remove(nodes);
        if (next.length === 0) {
          const n = createNode();
          insertedId = n.id;
          return [n];
        }
        return next;
      }, "immediate");
      if (insertedId) focusNodeAfterCommit(insertedId);
    },
    [updateActiveNodes, focusNodeAfterCommit],
  );

  const deleteNodeAndFocusPrev = useCallback(
    (nodeId: string) => {
      const activeNodes = memosRef.current.find((m) => m.id === activeMemoIdRef.current)?.nodes ?? [];
      const prevId = getPrevNodeId(activeNodes, nodeId);
      removeNode(nodeId);
      if (prevId) requestAnimationFrame(() => focusNode(prevId));
    },
    [removeNode, focusNode],
  );

  const handleIndent = useCallback(
    (nodeId: string) => updateActiveNodes((nodes) => indentNode(nodes, nodeId), "immediate"),
    [updateActiveNodes],
  );

  const handleUnindent = useCallback(
    (nodeId: string) => updateActiveNodes((nodes) => unindentNode(nodes, nodeId), "immediate"),
    [updateActiveNodes],
  );

  const handleBulkIndent = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      updateActiveNodes((prev) => {
        const flat = flattenPreorderIds(prev);
        const set = new Set(nodeIds);
        let next = prev;
        for (const id of flat) {
          if (!set.has(id)) continue;
          next = indentNode(next, id);
        }
        return next;
      }, "immediate");
    },
    [updateActiveNodes],
  );

  const handleBulkUnindent = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      updateActiveNodes((prev) => {
        const flat = flattenPreorderIds(prev);
        const set = new Set(nodeIds);
        let next = prev;
        for (let i = flat.length - 1; i >= 0; i--) {
          const id = flat[i]!;
          if (!set.has(id)) continue;
          next = unindentNode(next, id);
        }
        return next;
      }, "immediate");
    },
    [updateActiveNodes],
  );

  const toggleCompleted = useCallback(
    (nodeId: string) =>
      updateActiveNodes(
        (nodes) => mapTree(nodes, (n) => (n.id === nodeId ? { ...n, completed: !n.completed } : n)),
        "immediate",
      ),
    [updateActiveNodes],
  );

  const toggleHasCheckbox = useCallback(
    (nodeId: string) =>
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => {
            if (n.id !== nodeId) return n;
            return { ...n, hasCheckbox: !n.hasCheckbox, completed: n.hasCheckbox ? false : n.completed };
          }),
        "immediate",
      ),
    [updateActiveNodes],
  );

  const setNote = useCallback(
    (nodeId: string, text: string | null) =>
      updateActiveNodes(
        (nodes) => mapTree(nodes, (n) => (n.id === nodeId ? { ...n, note: text } : n)),
        "none",
      ),
    [updateActiveNodes],
  );

  const toggleNote = useCallback(
    (nodeId: string) =>
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) =>
            n.id === nodeId ? { ...n, note: n.note === null ? "" : null } : n,
          ),
        "immediate",
      ),
    [updateActiveNodes],
  );

  const setNodeBgColor = useCallback(
    (nodeId: string, color: string | null, opts?: { skipHistory?: boolean }) =>
      updateActiveNodes(
        (nodes) => mapTree(nodes, (n) => (n.id === nodeId ? { ...n, bgColor: color } : n)),
        opts?.skipHistory ? "none" : "immediate",
      ),
    [updateActiveNodes],
  );

  const setNodesBgColorBatch = useCallback(
    (nodeIds: string[], color: string | null, opts?: { skipHistory?: boolean }) => {
      if (nodeIds.length === 0) return;
      const set = new Set(nodeIds);
      updateActiveNodes(
        (nodes) => mapTree(nodes, (n) => (set.has(n.id) ? { ...n, bgColor: color } : n)),
        opts?.skipHistory ? "none" : "immediate",
      );
    },
    [updateActiveNodes],
  );

  const setNodeHeading = useCallback(
    (nodeId: string, level: HeadingLevel) =>
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => (n.id === nodeId ? { ...n, headingLevel: level } : n)),
        "immediate",
      ),
    [updateActiveNodes],
  );

  const setNodesHeadingBatch = useCallback(
    (nodeIds: string[], level: HeadingLevel) => {
      if (nodeIds.length === 0) return;
      const set = new Set(nodeIds);
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => (set.has(n.id) ? { ...n, headingLevel: level } : n)),
        "immediate",
      );
    },
    [updateActiveNodes],
  );

  const patchActiveNodeContents = useCallback(
    (patches: Record<string, string>) => {
      if (Object.keys(patches).length === 0) return;
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) =>
            patches[n.id] !== undefined ? { ...n, content: patches[n.id]! } : n,
          ),
        "immediate",
      );
    },
    [updateActiveNodes],
  );

  const setNodeImageUrl = useCallback(
    (nodeId: string, url: string | null) => {
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) =>
            n.id === nodeId
              ? { ...n, imageUrl: url && url.trim() ? url.trim() : null }
              : n,
          ),
        "immediate",
      );
    },
    [updateActiveNodes],
  );

  const insertElectronicSongStructure = useCallback(
    (anchorNodeId: string | null) => {
      const block = ELECTRONIC_SONG_STRUCTURE_LABELS.map((title) =>
        createNode({
          content: title,
          children: [createNode()],
        }),
      );
      updateActiveNodes(
        (prev) => insertSiblingNodesAfter(prev, anchorNodeId, [...block]),
        "immediate",
      );
      const firstChildId = block[0]?.children[0]?.id;
      if (firstChildId) requestAnimationFrame(() => focusNode(firstChildId));
    },
    [updateActiveNodes, focusNode],
  );

  const stripHtmlToPlain = (html: string): string => {
    if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent ?? "";
  };

  const addPluginSibling = useCallback(
    (anchorNodeId: string | null) => {
      const pluginNode = createNode({
        pluginData: { ...DEFAULT_PLUGIN_DATA },
        content: "",
      });
      updateActiveNodes((prev) => insertSiblingNodesAfter(prev, anchorNodeId, [pluginNode]), "immediate");
      requestAnimationFrame(() => focusNode(pluginNode.id));
    },
    [updateActiveNodes, focusNode],
  );

  const convertNodeToPluginCard = useCallback(
    (nodeId: string) => {
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => {
            if (n.id !== nodeId) return n;
            const plain = stripHtmlToPlain(n.content).trim();
            return {
              ...n,
              content: "",
              imageUrl: null,
              gameData: undefined,
              pluginData: {
                ...DEFAULT_PLUGIN_DATA,
                name: plain.slice(0, 500),
              },
            };
          }),
        "immediate",
      );
      requestAnimationFrame(() => focusNode(nodeId));
    },
    [updateActiveNodes, focusNode],
  );

  const convertNodeToGameSpecCard = useCallback(
    (nodeId: string) => {
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => {
            if (n.id !== nodeId) return n;
            const plain = stripHtmlToPlain(n.content).trim();
            return {
              ...n,
              content: "",
              imageUrl: null,
              pluginData: undefined,
              gameData: {
                ...DEFAULT_GAME_DATA,
                name: plain.slice(0, 500),
              },
            };
          }),
        "immediate",
      );
      requestAnimationFrame(() => focusNode(nodeId));
    },
    [updateActiveNodes, focusNode],
  );

  const addGameSpecSibling = useCallback(
    (anchorNodeId: string | null) => {
      const specNode = createNode({
        gameData: { ...DEFAULT_GAME_DATA },
        content: "",
      });
      updateActiveNodes((prev) => insertSiblingNodesAfter(prev, anchorNodeId, [specNode]), "immediate");
      requestAnimationFrame(() => focusNode(specNode.id));
    },
    [updateActiveNodes, focusNode],
  );

  const patchNodePluginData = useCallback(
    (nodeId: string, patch: Partial<NotePluginData>, historyMode: "immediate" | "none" = "none") => {
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => {
            if (n.id !== nodeId || !n.pluginData) return n;
            return { ...n, pluginData: { ...n.pluginData, ...patch } };
          }),
        historyMode,
      );
    },
    [updateActiveNodes],
  );

  const patchNodeGameData = useCallback(
    (nodeId: string, patch: Partial<NoteGameData>, historyMode: "immediate" | "none" = "none") => {
      updateActiveNodes(
        (nodes) =>
          mapTree(nodes, (n) => {
            if (n.id !== nodeId || !n.gameData) return n;
            return {
              ...n,
              gameData: normalizeGameData({ ...n.gameData, ...patch }),
            };
          }),
        historyMode,
      );
    },
    [updateActiveNodes],
  );

  const importFullBackupFromFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const backup = parseFreaviaFullBackupJson(text);
      let memosNext = backup.data.memos.map((m) => normalizeMemo(m as Partial<Memo>));
      let fileItemsNext = backup.data.fileItems
        .map(normalizeFileItem)
        .filter(Boolean) as FileItem[];
      fileItemsNext = syncMemoTypesIntoFileItems(memosNext, fileItemsNext);
      fileItemsNext = ensureFileItemsCoverMemos(memosNext, fileItemsNext);
      let activeId = backup.data.activeMemoId;
      if (!memosNext.some((m) => m.id === activeId)) {
        activeId = memosNext[0]!.id;
      }
      const remapped = remapInvalidMemoIds(memosNext, fileItemsNext, activeId);
      if (remapped) {
        memosNext = remapped.memos;
        fileItemsNext = remapped.fileItems;
        activeId = remapped.activeMemoId;
      }
      memosNext = mergeMemosThemeFromSidebarLabels(memosNext, fileItemsNext);
      applyFreaviaBackupLocalStoragePatches(backup.data);

      historyRef.current = new Map();
      setCanUndo(false);
      setCanRedo(false);
      lastCloudFingerprintRef.current.clear();
      lastCloudFolderFingerprintRef.current = "";
      setMemos(memosNext);
      setFileItems(fileItemsNext);
      setActiveMemoId(activeId);

      const client = getSupabaseBrowserClient();
      if (cloudReady && user && client) {
        setCloudPhase("saving");
        setCloudMessage(undefined);
        try {
          for (const m of memosNext) {
            if (!isUuid(m.id)) continue;
            if (isMemoReadOnlyForCurrentUser(m, user.id)) continue;
            const it = fileItemsNext.find((i) => i.id === m.id && i.type === "memo");
            await upsertMemoRow(client, user.id, m, it);
            lastCloudFingerprintRef.current.set(m.id, cloudMemoFingerprint(m, it));
          }
          const folders = fileItemsNext.filter((i) => i.type === "folder");
          await replaceUserFolders(client, user.id, folders);
          lastCloudFolderFingerprintRef.current = cloudFoldersFingerprint(folders);
          setCloudPhase("saved");
          window.setTimeout(() => {
            setCloudPhase((p) => (p === "saved" ? "idle" : p));
          }, 1400);
        } catch (e) {
          logFreaviaCloudError("[useMemos] import backup sync failed", e);
          setCloudPhase("error");
          setCloudMessage(cloudErrorUserMessage(e, "Import sync failed"));
          throw e;
        }
      }
    },
    [cloudReady, user],
  );

  const exportFullBackup = useCallback(() => {
    const payload = buildFreaviaFullBackupV1(
      memosRef.current,
      fileItemsRef.current,
      activeMemoIdRef.current,
    );
    downloadFreaviaBackupJson(payload);
  }, []);

  return {
    memos,
    activeMemoId,
    activeMemo,
    activeMemoReadOnly,
    switchMemo,
    addMemo,
    setMemoType,
    initMusicModuleForMemo,
    patchActiveMusicMeta,
    patchActiveGamedevMeta,
    updateMemoTitle,
    // file system
    fileItems,
    addFolder,
    toggleFolder,
    expandFoldersToRevealItem,
    ensureFolderOpen,
    expandNodePathInMemo,
    renameItem,
    deleteFileItem,
    moveItem,
    moveItems,
    duplicateMemo,
    toggleBookmark,
    setItemIcon,
    setItemColor,
    exportMemo,
    exportFullBackup,
    importFullBackupFromFile,
    // history
    canUndo,
    canRedo,
    undo,
    redo,
    beginMemoTextUndoSession,
    endMemoTextUndoSession: endTextUndoSession,
    beginMemoColorSliderUndoGesture,
    endMemoColorSliderUndoGesture,
    // node interface
    nodes: activeMemo.nodes,
    setNodeContent,
    toggleCollapsed,
    addChild,
    addSibling,
    insertSiblingWithPlainTextAfter,
    addRootNode,
    removeNode,
    deleteNodeAndFocusPrev,
    handleIndent,
    handleUnindent,
    handleBulkIndent,
    handleBulkUnindent,
    toggleCompleted,
    toggleHasCheckbox,
    setNote,
    toggleNote,
    setNodeBgColor,
    setNodesBgColorBatch,
    setNodeHeading,
    setNodesHeadingBatch,
    patchActiveNodeContents,
    setNodeImageUrl,
    insertElectronicSongStructure,
    addPluginSibling,
    convertNodeToPluginCard,
    convertNodeToGameSpecCard,
    addGameSpecSibling,
    patchNodePluginData,
    patchNodeGameData,
    setMemoWorkflowStatus,
    cloudSync: {
      phase: cloudPhase,
      message: cloudMessage,
      remoteEnabled: Boolean(configured && user),
    },
  };
}

export type { Memo } from "@/types/memoApp";
