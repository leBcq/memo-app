"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Folder, ListTree } from "lucide-react";
import type { Memo } from "@/hooks/useMemos";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/types/fileSystem";
import type { NoteNode } from "@/types/note";

export type CommandPick =
  | { kind: "memo"; memoId: string }
  | { kind: "folder"; folderId: string }
  | { kind: "node"; memoId: string; nodeId: string };

type IndexedRow = {
  id: string;
  pick: CommandPick;
  haystack: string;
  title: string;
  subtitle?: string;
  plainSnippet?: string;
};

function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function flattenMemoNodes(
  nodes: NoteNode[],
  memoId: string,
  memoTitle: string,
  out: IndexedRow[],
): void {
  const walk = (list: NoteNode[]) => {
    for (const n of list) {
      const plain = n.pluginData
        ? [n.pluginData.name, n.pluginData.category, n.pluginData.purpose].filter(Boolean).join(" · ") ||
          "(plugin)"
        : n.gameData
          ? [n.gameData.name, n.gameData.category, n.gameData.stats, n.gameData.description]
              .filter(Boolean)
              .join(" · ") || "(spec)"
          : htmlToPlainText(n.content);
      const noteT = n.note ? n.note.trim() : "";
      const haystack = [plain, noteT, memoTitle].join("\n").toLowerCase();
      const linePreview = plain.slice(0, 220) || "(空の行)";
      out.push({
        id: `node:${memoId}:${n.id}`,
        pick: { kind: "node", memoId, nodeId: n.id },
        haystack,
        title: linePreview.length > 72 ? `${linePreview.slice(0, 72)}…` : linePreview,
        subtitle: memoTitle || "Untitled Memo",
        plainSnippet: linePreview,
      });
      walk(n.children);
    }
  };
  walk(nodes);
}

function buildSearchIndex(memos: Memo[], fileItems: FileItem[]): IndexedRow[] {
  const rows: IndexedRow[] = [];
  const memoById = new Map(memos.map((m) => [m.id, m]));

  for (const item of fileItems) {
    const name = (item.name || "").trim();
    const hay = name.toLowerCase();
    if (item.type === "folder") {
      rows.push({
        id: `folder:${item.id}`,
        pick: { kind: "folder", folderId: item.id },
        haystack: hay,
        title: name || "Folder",
      });
    } else {
      const memo = memoById.get(item.id);
      const title = memo?.title?.trim() ? memo.title : name || "Untitled Memo";
      const thay = `${title}\n${name}`.toLowerCase();
      rows.push({
        id: `memo:${item.id}`,
        pick: { kind: "memo", memoId: item.id },
        haystack: thay,
        title,
        subtitle: "Memo",
      });
      if (memo) flattenMemoNodes(memo.nodes, memo.id, title, rows);
    }
  }
  return rows;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold text-cyan-200">{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </>
  );
}

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  memos: Memo[];
  fileItems: FileItem[];
  onPick: (pick: CommandPick) => void;
};

export default function CommandPalette({
  open,
  onClose,
  memos,
  fileItems,
  onPick,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const indexRows = useMemo(() => buildSearchIndex(memos, fileItems), [memos, fileItems]);

  const displayRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return indexRows.filter((r) => r.pick.kind !== "node").slice(0, 80);
    }
    return indexRows.filter((r) => r.haystack.includes(q)).slice(0, 200);
  }, [indexRows, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActiveIndex((i) => (displayRows.length === 0 ? 0 : Math.min(i, displayRows.length - 1)));
  }, [displayRows.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, displayRows]);

  const commit = useCallback(
    (idx: number) => {
      const row = displayRows[idx];
      if (!row) return;
      onPick(row.pick);
      onClose();
      setQuery("");
    },
    [displayRows, onPick, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        setQuery("");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (displayRows.length === 0 ? 0 : (i + 1) % displayRows.length));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) =>
          displayRows.length === 0 ? 0 : (i - 1 + displayRows.length) % displayRows.length,
        );
      }
      if (e.key === "Enter") {
        e.preventDefault();
        commit(activeIndex);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, displayRows.length, activeIndex, commit, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="グローバル検索"
      className="fixed inset-0 z-[10020] flex items-start justify-center pt-[min(18vh,140px)] px-4"
    >
      <button
        type="button"
        aria-label="閉じる"
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
        onClick={() => {
          onClose();
          setQuery("");
        }}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl overflow-hidden rounded-xl border border-cyan-500/25",
          "bg-zinc-950/92 shadow-[0_0_0_1px_rgba(6,182,212,0.12),0_24px_80px_rgba(0,0,0,0.65)]",
          "ring-1 ring-cyan-400/10",
        )}
      >
        <div className="border-b border-zinc-800/80 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 px-3 py-3">
          <div className="flex items-center gap-2 px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/70">
              Search
            </span>
            <span className="text-zinc-600">·</span>
            <span className="font-mono text-[10px] text-zinc-500">Ctrl+P</span>
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="メモ、フォルダ、ノード本文を検索…"
            className={cn(
              "mt-2 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-4 py-3",
              "font-mono text-base text-zinc-100 placeholder:text-zinc-600",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none",
              "focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20",
            )}
          />
        </div>
        <div
          ref={listRef}
          className="max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain px-2 py-2"
        >
          {displayRows.length === 0 ? (
            <p className="px-3 py-8 text-center font-mono text-sm text-zinc-500">
              一致する項目がありません
            </p>
          ) : (
            displayRows.map((row, idx) => {
              const active = idx === activeIndex;
              const Icon =
                row.pick.kind === "folder" ? Folder : row.pick.kind === "memo" ? FileText : ListTree;
              return (
                <button
                  key={row.id}
                  type="button"
                  data-cmd-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(idx)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-cyan-500/15 ring-1 ring-cyan-500/35"
                      : "hover:bg-zinc-800/60",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      row.pick.kind === "folder"
                        ? "text-amber-400/90"
                        : row.pick.kind === "memo"
                          ? "text-cyan-400/90"
                          : "text-fuchsia-400/80",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-zinc-100">
                      <HighlightMatch text={row.title} query={query} />
                    </div>
                    {row.subtitle && (
                      <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                        <HighlightMatch text={row.subtitle} query={query} />
                      </div>
                    )}
                    {row.plainSnippet && query.trim() && (
                      <div className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-zinc-400">
                        <HighlightMatch text={row.plainSnippet} query={query} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
