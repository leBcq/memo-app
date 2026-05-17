import type { FileItem } from "@/types/fileSystem";
import type { Memo } from "@/hooks/useMemos";

/**
 * Keep in sync with persisted keys in useMemos, SettingsContext, useSong, useNoteEditor, page.tsx.
 */
const STORAGE = {
  settings: "geo-memo-settings-v1",
  songMeta: "geo-memo-song-meta",
  legacyNoteEditor: "geo-memo-v2",
  sidebarWidth: "geo-memo:sidebar-width",
  sidebarOpen: "geo-memo:sidebar-open",
} as const;

function readJsonKey(key: string): unknown {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readSidebarWidth(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE.sidebarWidth);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readSidebarOpen(): boolean | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE.sidebarOpen);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return null;
}

/** Full app snapshot for offline backup (pretty-printed JSON on export). */
export type FreaviaFullBackupV1 = {
  schemaVersion: 1;
  exportedAt: string;
  app: "freavia";
  data: {
    memos: Memo[];
    fileItems: FileItem[];
    activeMemoId: string;
    settings: unknown;
    songMeta: unknown;
    /** Legacy `useNoteEditor` tree, if present—may be unused by main app. */
    legacyNoteEditorNodes: unknown;
    ui: {
      sidebarWidthPx: number | null;
      sidebarOpen: boolean | null;
    };
  };
};

export function buildFreaviaFullBackupV1(
  memos: Memo[],
  fileItems: FileItem[],
  activeMemoId: string,
): FreaviaFullBackupV1 {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "freavia",
    data: {
      memos,
      fileItems,
      activeMemoId,
      settings: readJsonKey(STORAGE.settings),
      songMeta: readJsonKey(STORAGE.songMeta),
      legacyNoteEditorNodes: readJsonKey(STORAGE.legacyNoteEditor),
      ui: {
        sidebarWidthPx: readSidebarWidth(),
        sidebarOpen: readSidebarOpen(),
      },
    },
  };
}

/** Trigger browser download of a formatted JSON backup (local date in filename). */
export function downloadFreaviaBackupJson(payload: FreaviaFullBackupV1): void {
  if (typeof document === "undefined") return;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  a.download = `freavia-backup-${y}-${m}-${day}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
