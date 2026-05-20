"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CommandPalette, { type CommandPick } from "@/components/CommandPalette";
import NodeList from "@/components/Editor/NodeList";
import Toolbar from "@/components/Editor/Toolbar";
import { FileSidebar } from "@/components/FileSidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { ShareMemoModal } from "@/components/ShareMemoModal";
import { TrackStatusBar } from "@/components/TrackStatusBar";
import { GamedevToolbarStrip } from "@/components/GamedevToolbarStrip";
import { CloudSyncIndicator } from "@/components/CloudSyncIndicator";
import { PcSidebarToggleButton } from "@/components/PcSidebarToggleButton";
import { useMemos } from "@/hooks/useMemos";
import { useAuth } from "@/contexts/AuthContext";
import { matchesKeybind } from "@/config/keybinds";
import { useSettings } from "@/contexts/SettingsContext";
import { findNodePath } from "@/lib/treeUtils";
import { cn } from "@/lib/utils";
import {
  getMemoThemeColor,
  fileItemColorThemeChromeAlphaMultiplier,
  isColorFullyTransparent,
  EDITOR_STANDARD_TEXT_COLOR,
  EDITOR_STANDARD_CARET_COLOR,
} from "@/lib/memoThemeColor";
import { Menu, MousePointer2, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMobileUiStore } from "@/stores/mobileUiStore";
import type { MemoType } from "@/types/memoKind";
import type { HeadingLevel, NoteNode } from "@/types/note";
import type { MessageId } from "@/i18n/messages";
import { useTranslation } from "@/i18n/useTranslation";

// ─── Node tree helpers ────────────────────────────────────────────────────────

/** Find a single node by ID anywhere in the tree. */
function findNodeById(nodes: NoteNode[], id: string): NoteNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function crumbLabelRich(node: NoteNode, t: (id: MessageId) => string): React.ReactNode {
  if (node.pluginData) {
    const n = node.pluginData.name.trim();
    return n ? n : <span className="italic text-zinc-600">{t("crumb.pluginFallback")}</span>;
  }
  if (node.gameData) {
    const n = node.gameData.name.trim();
    return n ? n : <span className="italic text-zinc-600">{t("crumb.specFallback")}</span>;
  }
  if (node.content) {
    return <span dangerouslySetInnerHTML={{ __html: node.content }} />;
  }
  return <span className="italic text-zinc-600">{t("sidebar.untitledMemo")}</span>;
}

/** Strip HTML tags to get plain text. */
function htmlToPlainText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

/** Collect text from selected nodes preserving indent depth. */
function collectSelectedText(nodes: NoteNode[], selected: Set<string>, depth = 0): string {
  const lines: string[] = [];
  for (const node of nodes) {
    if (selected.has(node.id)) {
      const line = node.pluginData
        ? [node.pluginData.name, node.pluginData.category, node.pluginData.purpose].filter(Boolean).join(" · ")
        : node.gameData
          ? [node.gameData.name, node.gameData.category, node.gameData.stats].filter(Boolean).join(" · ")
          : htmlToPlainText(node.content);
      lines.push("\t".repeat(depth) + line);
    }
    const childLines = collectSelectedText(node.children, selected, depth + 1);
    if (childLines) lines.push(childLines);
  }
  return lines.join("\n");
}

/** All note block roots in visual DOM order (one entry per node). */
function getDomOrderedNodeIds(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-geo-block="note-node"]'),
  ).map((el) => el.getAttribute("data-node-id") ?? "").filter(Boolean);
}

function intersects(a: DOMRect, b: { left: number; top: number; right: number; bottom: number }): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

const SIDEBAR_WIDTH_KEY = "geo-memo:sidebar-width";
const SIDEBAR_OPEN_KEY = "geo-memo:sidebar-open";
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 208; // ≈ w-52

/** Memo/outline contenteditables use the app-wide undo stack; others (e.g. BPM) keep native text undo. */
const GLOBAL_UNDO_CONTENTEDITABLE_SELECTOR =
  '[data-geo-editor="body"],[data-geo-editor="focus-title"],[data-geo-editor="plugin-card"],[data-geo-editor="game-spec-card"]';

/** When true, let the browser handle Ctrl/Cmd+Z so field text undo is not swallowed. */
function shouldDeferGlobalUndoToNative(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    const nativeTypes = new Set([
      "button",
      "submit",
      "reset",
      "checkbox",
      "radio",
      "file",
      "range",
      "color",
    ]);
    if (nativeTypes.has(el.type)) return false;
    return true;
  }
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) {
    if (el.closest(GLOBAL_UNDO_CONTENTEDITABLE_SELECTOR)) return false;
    return true;
  }
  return false;
}

const BLOCK_SELECT_DRAG_THRESHOLD_PX = 4;

export default function Home() {
  const { t } = useTranslation();
  const crumbLabel = useCallback((node: NoteNode) => crumbLabelRich(node, t), [t]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeEditorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const memoWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ── Focus (zoom) mode ───────────────────────────────────────────────────────
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const focusedHeaderRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();

  // ── Multi-node block selection (explicit state; not browser text selection) ──
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isDragSelectRef = useRef(false);
  /** Anchor for Shift+click range and drag-to-select */
  const selectionAnchorRef = useRef<string | null>(null);
  const isMarqueeRef = useRef(false);
  const marqueeOriginRef = useRef({ x: 0, y: 0 });
  /** Pending pointer for Alt/mobile: click toggles, move extends range */
  const blockSelectPointerRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const blockSelectRangeDragRef = useRef(false);
  const [marqueeRect, setMarqueeRect] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  /** True while Alt is held: block-selection UX + editors locked */
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const isSelectionModeRef = useRef(false);

  // ── Sidebar resize ──────────────────────────────────────────────────────────
  // Always start with default to avoid SSR/hydration mismatch, then restore
  // from localStorage synchronously before first paint via useLayoutEffect.
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isMobileSelectionMode = useMobileUiStore((s) => s.isMobileSelectionMode);
  const toggleMobileSelectionMode = useMobileUiStore((s) => s.toggleMobileSelectionMode);
  const setMobileSelectionMode = useMobileUiStore((s) => s.setMobileSelectionMode);
  const effectiveSelectionMode = isSelectionMode || isMobileSelectionMode;
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWRef = useRef(0);

  useLayoutEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : NaN;
    if (!isNaN(parsed)) {
      setSidebarWidth(Math.min(Math.max(parsed, SIDEBAR_MIN), SIDEBAR_MAX));
    }

    const mq = window.matchMedia("(min-width: 768px)");
    const syncSidebarOpen = () => {
      if (mq.matches) {
        const openRaw = localStorage.getItem(SIDEBAR_OPEN_KEY);
        setIsSidebarOpen(openRaw !== "0");
      } else {
        setIsSidebarOpen(false);
      }
    };
    syncSidebarOpen();
    mq.addEventListener("change", syncSidebarOpen);
    return () => mq.removeEventListener("change", syncSidebarOpen);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: globalThis.MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = e.clientX - resizeStartXRef.current;
      const next = Math.min(Math.max(resizeStartWRef.current + delta, SIDEBAR_MIN), SIDEBAR_MAX);
      setSidebarWidth(next);
    };
    const onMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setSidebarWidth((w) => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
        return w;
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const togglePcSidebar = useCallback(() => {
    setIsSidebarOpen((o) => {
      const next = !o;
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
        localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const {
    memos,
    activeMemoId,
    activeMemo,
    switchMemo,
    addMemo,
    setMemoType,
    patchActiveMusicMeta,
    updateMemoTitle,
    fileItems,
    addFolder,
    toggleFolder,
    expandFoldersToRevealItem,
    ensureFolderOpen,
    expandNodePathInMemo,
    renameItem,
    deleteFileItem,
    moveItems,
    duplicateMemo,
    toggleBookmark,
    setItemIcon,
    setItemColor,
    exportMemo,
    exportFullBackup,
    importFullBackupFromFile,
    canUndo,
    canRedo,
    undo,
    redo,
    beginMemoTextUndoSession,
    endMemoTextUndoSession,
    beginMemoColorSliderUndoGesture,
    endMemoColorSliderUndoGesture,
    nodes,
    setNodeContent,
    setNodeImageUrl,
    toggleCollapsed,
    addChild,
    addSibling,
    addRootNode,
    removeNode,
    deleteNodeAndFocusPrev,
    handleIndent,
    handleUnindent,
    handleBulkIndent,
    handleBulkUnindent,
    toggleCompleted,
    toggleHasCheckbox,
    toggleNote,
    setNote,
    setNodeBgColor,
    setNodesBgColorBatch,
    setNodeHeading,
    setNodesHeadingBatch,
    patchActiveNodeContents,
    insertElectronicSongStructure,
    addPluginSibling,
    addGameSpecSibling,
    convertNodeToPluginCard,
    convertNodeToGameSpecCard,
    patchNodePluginData,
    patchNodeGameData,
    setMemoWorkflowStatus,
    patchActiveGamedevMeta,
    cloudSync,
    activeMemoReadOnly,
  } = useMemos();

  const { user } = useAuth();

  const handleSetBgColor = useCallback(
    (id: string, color: string | null, opts?: { skipHistory?: boolean }) => {
      if (selectedIds.length >= 2) {
        setNodesBgColorBatch(selectedIds, color, opts);
      } else {
        setNodeBgColor(id, color, opts);
      }
    },
    [selectedIds, setNodesBgColorBatch, setNodeBgColor],
  );

  const handleSetHeading = useCallback(
    (id: string, level: HeadingLevel) => {
      if (selectedIds.length >= 2) {
        setNodesHeadingBatch(selectedIds, level);
      } else {
        setNodeHeading(id, level);
      }
    },
    [selectedIds, setNodesHeadingBatch, setNodeHeading],
  );

  const handleAddMemo = (parentId: string | null = null, kind: MemoType = "standard") => {
    addMemo(parentId, kind);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  // ── Focus mode helpers ────────────────────────────────────────────────────
  const focusedPath = useMemo(
    () => (focusedNodeId ? findNodePath(nodes, focusedNodeId) : null),
    [nodes, focusedNodeId],
  );

  const displayNodes = useMemo<NoteNode[]>(() => {
    if (!focusedNodeId) return nodes;
    const target = findNodeById(nodes, focusedNodeId);
    return target ? target.children : nodes;
  }, [nodes, focusedNodeId]);

  const focusedNodeSnapshot = useMemo(
    () => (focusedNodeId ? findNodeById(nodes, focusedNodeId) : null),
    [nodes, focusedNodeId],
  );

  const activeMemoFileItem = useMemo(
    () => fileItems.find((i) => i.id === activeMemoId && i.type === "memo") ?? null,
    [fileItems, activeMemoId],
  );
  const memoWorkflowStatus = activeMemoFileItem?.workflowStatus ?? "DRAFT";

  const memoThemeColor = useMemo(() => getMemoThemeColor(activeMemo), [activeMemo]);

  const themeChromeAlphaMult = useMemo(() => {
    const fromFile = fileItemColorThemeChromeAlphaMultiplier(activeMemoFileItem?.color);
    const tc = activeMemo.themeColor;
    if (typeof tc === "string" && isColorFullyTransparent(tc)) return 0;
    return fromFile;
  }, [activeMemoFileItem?.color, activeMemo.themeColor]);

  const handleFocusNode = useCallback((id: string) => {
    const target = findNodeById(nodes, id);
    if (target && target.children.length === 0) {
      addChild(id); // auto-create one child so the list is never empty
    }
    setFocusedNodeId(id);
  }, [nodes, addChild]);

  const handleUnfocus = useCallback((toId: string | null = null) => {
    setFocusedNodeId(toId);
  }, []);

  const handleCommandPick = useCallback(
    (pick: CommandPick) => {
      if (pick.kind === "folder") {
        expandFoldersToRevealItem(pick.folderId);
        ensureFolderOpen(pick.folderId);
        return;
      }
      expandFoldersToRevealItem(pick.memoId);
      switchMemo(pick.memoId);
      setFocusedNodeId(null);
      setSelectedIds([]);
      selectionAnchorRef.current = null;
      if (pick.kind === "node") {
        expandNodePathInMemo(pick.memoId, pick.nodeId);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector<HTMLElement>(
              `[data-node-id="${pick.nodeId}"] [data-geo-editor="body"]`,
            );
            if (!el) return;
            el.scrollIntoView({ block: "center", behavior: "smooth" });
            el.focus();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
          });
        });
      }
    },
    [
      expandFoldersToRevealItem,
      ensureFolderOpen,
      switchMemo,
      expandNodePathInMemo,
    ],
  );

  // Reset focus when memo changes
  useEffect(() => { setFocusedNodeId(null); }, [activeMemoId]);
  useEffect(() => { setSelectedIds([]); selectionAnchorRef.current = null; }, [activeMemoId]);
  useEffect(() => {
    setMobileSelectionMode(false);
  }, [activeMemoId, setMobileSelectionMode]);

  // Sync focused-node header contenteditable when the focused node changes
  useLayoutEffect(() => {
    if (!focusedHeaderRef.current || !focusedNodeId) return;
    const node = findNodeById(nodes, focusedNodeId);
    if (!node || node.pluginData || node.gameData) return;
    focusedHeaderRef.current.innerHTML = node.content || "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNodeId]); // intentionally NOT re-syncing on content change to keep cursor

  // ── Alt = selection mode (release = resume editing; selectedIds may stay) ───
  useEffect(() => {
    const clearDragging = () => {
      isDragSelectRef.current = false;
      isMarqueeRef.current = false;
      blockSelectPointerRef.current = null;
      blockSelectRangeDragRef.current = false;
      setMarqueeRect(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Alt" || e.repeat) return;
      isSelectionModeRef.current = true;
      setIsSelectionMode(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      isSelectionModeRef.current = false;
      setIsSelectionMode(false);
      clearDragging();
    };
    const onBlur = () => {
      isSelectionModeRef.current = false;
      setIsSelectionMode(false);
      clearDragging();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // ── Global search palette (Ctrl/Cmd + P) ───────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Global keyboard shortcuts (Undo/Redo + Focus) ─────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (commandPaletteOpen || settingsOpen) return;

      // Undo/Redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) — capture runs before contenteditable swallows keys
      const meta = e.ctrlKey || e.metaKey;
      if (meta) {
        const key = e.key.toLowerCase();
        const undoRedo =
          key === "y" || (key === "z" && e.shiftKey)
            ? "redo"
            : key === "z" && !e.shiftKey
              ? "undo"
              : null;
        if (undoRedo) {
          if (shouldDeferGlobalUndoToNative()) return;
          e.preventDefault();
          e.stopPropagation();
          if (undoRedo === "undo") undo();
          else redo();
          return;
        }
      }

      // Focus mode (Alt+→ / Alt+←)
      if (matchesKeybind(e, settings.keymap.FOCUS_NODE)) {
        e.preventDefault();
        if (activeId) handleFocusNode(activeId);
        return;
      }
      if (matchesKeybind(e, settings.keymap.UNFOCUS_NODE)) {
        e.preventDefault();
        if (focusedPath && focusedPath.length > 1) {
          // Go up one level
          handleUnfocus(focusedPath[focusedPath.length - 2].id);
        } else {
          handleUnfocus(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    undo,
    redo,
    activeId,
    focusedPath,
    handleFocusNode,
    handleUnfocus,
    settings.keymap,
    commandPaletteOpen,
    settingsOpen,
  ]);

  // Commit rich-text / title edits to the global undo stack when focus leaves the memo workspace.
  useEffect(() => {
    const el = memoWorkspaceRef.current;
    if (!el) return;
    const onFocusIn = (ev: FocusEvent) => {
      const t = ev.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      ) {
        beginMemoTextUndoSession();
        return;
      }
      if (t instanceof HTMLElement && t.isContentEditable) beginMemoTextUndoSession();
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const ae = document.activeElement;
        if (ae && el.contains(ae)) return;
        endMemoTextUndoSession();
      }, 0);
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [beginMemoTextUndoSession, endMemoTextUndoSession, activeMemoId]);

  // ── Block selection: Alt+Shift+click / Alt+drag / Alt+marquee ( editors locked while Alt held )
  const handleBlockSelectMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    const mobileSel = useMobileUiStore.getState().isMobileSelectionMode;
    if (!e.altKey && !mobileSel) return;

    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      blockSelectPointerRef.current = null;
      blockSelectRangeDragRef.current = false;
      const anchor = selectionAnchorRef.current ?? selectedIds[0] ?? id;
      const ids = getDomOrderedNodeIds();
      const aIdx = ids.indexOf(anchor);
      const bIdx = ids.indexOf(id);
      if (aIdx !== -1 && bIdx !== -1) {
        const [lo, hi] = aIdx <= bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
        const next = ids.slice(lo, hi + 1);
        setSelectedIds(next);
        selectionAnchorRef.current = anchor;
      } else {
        setSelectedIds([id]);
        selectionAnchorRef.current = id;
      }
      isDragSelectRef.current = false;
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    selectionAnchorRef.current = id;
    blockSelectPointerRef.current = { id, x: e.clientX, y: e.clientY };
    blockSelectRangeDragRef.current = false;
    isDragSelectRef.current = true;
  }, [selectedIds]);

  const handleMobileSelectNode = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
    selectionAnchorRef.current = id;
    isDragSelectRef.current = false;
    blockSelectPointerRef.current = null;
    blockSelectRangeDragRef.current = false;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0 || commandPaletteOpen || settingsOpen) return;
      if (activeMemoReadOnly) return;
      if (!matchesKeybind(e, settings.keymap.INDENT) && !matchesKeybind(e, settings.keymap.UNINDENT)) {
        return;
      }

      const ae = document.activeElement as HTMLElement | null;
      if (ae?.closest("[data-geo-editor-toolbar]")) return;
      if (ae?.closest("aside")) return;
      if (ae?.closest("[data-geo-mode-strip]")) return;
      if (ae?.closest('[role="dialog"]')) return;
      if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement) {
        return;
      }
      if (ae?.closest('[data-geo-editor="focus-title"]')) return;

      e.preventDefault();
      e.stopPropagation();
      if (matchesKeybind(e, settings.keymap.UNINDENT)) {
        handleBulkUnindent(selectedIds);
      } else {
        handleBulkIndent(selectedIds);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    selectedIds,
    settings.keymap,
    handleBulkIndent,
    handleBulkUnindent,
    commandPaletteOpen,
    settingsOpen,
    activeMemoReadOnly,
  ]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const blockSel =
        e.altKey || useMobileUiStore.getState().isMobileSelectionMode;
      if (!blockSel) {
        if (isMarqueeRef.current || isDragSelectRef.current) {
          isMarqueeRef.current = false;
          isDragSelectRef.current = false;
          blockSelectPointerRef.current = null;
          blockSelectRangeDragRef.current = false;
          setMarqueeRect(null);
        }
        return;
      }
      if (isMarqueeRef.current) {
        const { x, y } = marqueeOriginRef.current;
        setMarqueeRect({
          left: Math.min(x, e.clientX),
          top: Math.min(y, e.clientY),
          width: Math.abs(e.clientX - x),
          height: Math.abs(e.clientY - y),
        });
        return;
      }
      if (!isDragSelectRef.current || !selectionAnchorRef.current) return;
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const nodeEl = els.find(
        (el) =>
          el instanceof HTMLElement &&
          el.getAttribute("data-geo-block") === "note-node",
      ) as HTMLElement | undefined;
      if (!nodeEl) return;
      const hoverId = nodeEl.getAttribute("data-node-id") ?? "";
      if (!hoverId) return;

      const down = blockSelectPointerRef.current;
      if (down && !blockSelectRangeDragRef.current) {
        const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (dist > BLOCK_SELECT_DRAG_THRESHOLD_PX || hoverId !== down.id) {
          blockSelectRangeDragRef.current = true;
        }
      }
      if (!blockSelectRangeDragRef.current) return;

      const ids = getDomOrderedNodeIds();
      const aIdx = ids.indexOf(selectionAnchorRef.current);
      const bIdx = ids.indexOf(hoverId);
      if (aIdx === -1 || bIdx === -1) return;
      const [lo, hi] = aIdx <= bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
      setSelectedIds(ids.slice(lo, hi + 1));
    };

    const onUp = (e: MouseEvent) => {
      if (isMarqueeRef.current) {
        const { x, y } = marqueeOriginRef.current;
        const left = Math.min(x, e.clientX);
        const top = Math.min(y, e.clientY);
        const right = Math.max(x, e.clientX);
        const bottom = Math.max(y, e.clientY);
        const w = right - left;
        const h = bottom - top;
        isMarqueeRef.current = false;
        setMarqueeRect(null);
        if (w < 4 && h < 4) {
          /* tiny box: treat as accidental click, keep selection */
        } else {
          const box = { left, top, right, bottom };
          const hit: string[] = [];
          document.querySelectorAll<HTMLElement>('[data-geo-block="note-node"]').forEach((el) => {
            if (intersects(el.getBoundingClientRect(), box)) {
              const nid = el.getAttribute("data-node-id");
              if (nid) hit.push(nid);
            }
          });
          setSelectedIds(hit);
          selectionAnchorRef.current = hit[0] ?? null;
        }
        return;
      }

      if (
        isDragSelectRef.current &&
        blockSelectPointerRef.current &&
        !blockSelectRangeDragRef.current
      ) {
        const tid = blockSelectPointerRef.current.id;
        setSelectedIds((prev) => {
          if (prev.includes(tid)) return prev.filter((x) => x !== tid);
          return [...prev, tid];
        });
        selectionAnchorRef.current = tid;
      }
      blockSelectPointerRef.current = null;
      blockSelectRangeDragRef.current = false;
      isDragSelectRef.current = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ── Copy: hijack when block selection is active (capture phase) ────────────
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (selectedIds.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.isContentEditable) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.anchorNode && active.contains(sel.anchorNode)) {
          return;
        }
      }

      e.preventDefault();
      e.stopPropagation();
      const text = collectSelectedText(displayNodes, new Set(selectedIds));
      e.clipboardData?.setData("text/plain", text);
    };
    document.addEventListener("copy", onCopy, true);
    return () => document.removeEventListener("copy", onCopy, true);
  }, [selectedIds, displayNodes]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        memos={memos}
        fileItems={fileItems}
        onPick={handleCommandPick}
      />

      {marqueeRect && (marqueeRect.width > 1 || marqueeRect.height > 1) && (
        <div
          className="pointer-events-none fixed z-[9998] border border-cyan-400/70 bg-cyan-500/15"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width,
            height: marqueeRect.height,
          }}
        />
      )}
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="pointer-events-none fixed -left-8 top-12 h-40 w-40 rotate-45 border border-cyan-400/30" />
      <div className="pointer-events-none fixed bottom-10 right-12 h-48 w-48 border border-zinc-700/70" />

      <Toolbar
        isEditorActive={Boolean(activeId)}
        getActiveEditor={() => activeEditorRef.current}
        selectedIds={selectedIds}
        onPatchNodeContents={patchActiveNodeContents}
        onSyncActiveEditor={() => {
          if (!activeId || !activeEditorRef.current) return;
          setNodeContent(activeId, activeEditorRef.current.innerHTML ?? "");
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        memoType={activeMemo.memoType}
        workflowStatus={memoWorkflowStatus}
        onWorkflowChange={(s) => setMemoWorkflowStatus(activeMemoId, s)}
        gamedevStage={
          activeMemo.memoType === "gamedev" && activeMemo.gamedevMeta
            ? activeMemo.gamedevMeta.stage
            : undefined
        }
        onGamedevStageChange={
          activeMemo.memoType === "gamedev"
            ? (stage) => patchActiveGamedevMeta({ stage })
            : undefined
        }
        activeMemoId={activeMemoId}
        readOnly={activeMemoReadOnly}
      />

      <ShareMemoModal fileItems={fileItems} />
      <div className="relative z-0 flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        {isSidebarOpen && (
          <button
            type="button"
            aria-label={t("mobile.closeSidebarBackdrop")}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/*
          Sidebar flex slot: on mobile the outer shell stays width 0 so it does not steal ~80vw from the
          editor row (fixed children can still get a huge flex base size otherwise). The real drawer is the
          inner panel (fixed on max-md). When closed on mobile, inner uses display:none per Tailwind `hidden`.
        */}
        <div
          className={cn(
            "relative shrink-0 transition-[width] duration-300 ease-out",
            "max-md:w-0 max-md:min-w-0 max-md:max-w-0 max-md:overflow-visible",
            "md:flex md:h-full md:min-h-0 md:flex-col md:overflow-hidden",
            isSidebarOpen && isMdUp ? "md:border-r md:border-zinc-800/40" : "",
            !isSidebarOpen && isMdUp && "md:pointer-events-none md:border-r-0",
          )}
          style={isMdUp ? { width: isSidebarOpen ? sidebarWidth : 0 } : undefined}
        >
          <div
            className={cn(
              "relative flex h-full min-h-0 w-full flex-1 flex-col bg-zinc-950 transition-[width] duration-300 ease-out",
              // Mobile drawer: out of flex width calculation (parent is w-0)
              "max-md:fixed max-md:top-0 max-md:left-0 max-md:z-50 max-md:h-full max-md:w-[80vw] max-md:max-w-[320px] max-md:border-r max-md:border-zinc-800/40 max-md:shadow-[4px_0_28px_rgba(0,0,0,0.55)]",
              !isMdUp && !isSidebarOpen && "max-md:hidden",
              "md:relative md:inset-auto md:z-auto md:max-w-none md:shadow-none",
            )}
          >
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
            <FileSidebar
              width={sidebarWidth}
              fileItems={fileItems}
              memos={memos}
              currentUserId={user?.id ?? null}
              activeMemoId={activeMemoId}
              onSelectMemo={(id) => {
                switchMemo(id);
                if (typeof window !== "undefined" && !window.matchMedia("(min-width: 768px)").matches) {
                  setIsSidebarOpen(false);
                }
              }}
              onAddMemo={handleAddMemo}
              onSetMemoType={setMemoType}
              onAddFolder={addFolder}
              onToggleFolder={toggleFolder}
              onRenameItem={renameItem}
              onDeleteItem={deleteFileItem}
              onMoveItems={moveItems}
              onOpenSettings={() => setSettingsOpen(true)}
              onDuplicateMemo={duplicateMemo}
              onToggleBookmark={toggleBookmark}
              onSetItemIcon={setItemIcon}
              onSetItemColor={setItemColor}
              onExportMemo={exportMemo}
              onExportFullBackup={exportFullBackup}
              onImportFullBackup={importFullBackupFromFile}
              onMemoColorSliderUndoGestureStart={beginMemoColorSliderUndoGesture}
              onMemoColorSliderUndoGestureEnd={endMemoColorSliderUndoGesture}
              mobileDrawerLayout={!isMdUp}
            />
          </div>

          {/* Mobile close — outside clipped inner panel so overflow-x-hidden does not hide it */}
          {!isMdUp ? (
            <button
              type="button"
              className="absolute top-3 right-3 z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-zinc-100 shadow-lg shadow-black/40 md:hidden"
              aria-label={t("mobile.closeSidebar")}
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={18} strokeWidth={2} className="shrink-0" />
            </button>
          ) : null}
          </div>
        </div>

        {/* PC sidebar toggle — never inside the clipped sidebar panel; sibling in the flex row */}
        <PcSidebarToggleButton
          isSidebarOpen={isSidebarOpen}
          onToggle={togglePcSidebar}
          leftPx={isSidebarOpen ? sidebarWidth + 6 : 10}
          ariaLabelShow={t("app.sidebarShow")}
          ariaLabelHide={t("app.sidebarHide")}
          titleShow={t("app.sidebarShow")}
          titleHide={t("app.sidebarHide")}
        />

        {/* Resize handle — desktop only */}
        <div
          className={cn(
            "group relative z-10 hidden h-full min-h-0 w-1 shrink-0 cursor-col-resize items-center justify-center transition-all duration-300 ease-out md:flex",
            !isSidebarOpen && "pointer-events-none w-0 max-w-0 opacity-0",
          )}
          onMouseDown={(e) => {
            if (!isSidebarOpen) return;
            e.preventDefault();
            isResizingRef.current = true;
            resizeStartXRef.current = e.clientX;
            resizeStartWRef.current = sidebarWidth;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "col-resize";
          }}
        >
          <div className="h-full w-px bg-zinc-800/70 transition-colors group-hover:bg-cyan-500/50" />
        </div>

        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            onExportFullBackup={exportFullBackup}
          />
        )}

        <div
          ref={memoWorkspaceRef}
          data-memo-workspace
          className="relative z-0 flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden"
        >
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800/50 bg-zinc-950/95 px-2 md:hidden">
            <button
              type="button"
              aria-label={t("mobile.openSidebar")}
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/90 bg-zinc-900/50 text-zinc-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>
            <span className="min-w-0 truncate font-mono text-[11px] tracking-wide text-zinc-400">
              {activeMemo.title || t("app.memoTitlePlaceholder")}
            </span>
          </div>

          {/* Mode strip: music tools or gamedev spec tools (fixed h-9). */}
          <div
            className={cn(
              "relative z-30 h-9 shrink-0 overflow-visible transition-[border-color,background-color] duration-300 ease-in-out",
              (activeMemo.memoType === "music" && activeMemo.musicMeta) || activeMemo.memoType === "gamedev"
                ? "bg-zinc-950/95"
                : "border-b border-zinc-800/35 bg-zinc-950",
            )}
            data-geo-mode-strip
            onMouseDown={(e) => e.stopPropagation()}
          >
            {activeMemo.memoType === "music" && activeMemo.musicMeta ? (
              <TrackStatusBar
                key={activeMemoId}
                meta={activeMemo.musicMeta}
                onPatch={patchActiveMusicMeta}
                onInsertStructure={() => insertElectronicSongStructure(activeId)}
                onAddPlugin={() => addPluginSibling(activeId)}
                themeColor={memoThemeColor}
                themeChromeAlphaMult={themeChromeAlphaMult}
                rowTintSourceColor={activeMemoFileItem?.color}
                readOnly={activeMemoReadOnly}
              />
            ) : activeMemo.memoType === "gamedev" ? (
              <GamedevToolbarStrip
                onAddSpecCard={() => addGameSpecSibling(activeId)}
                themeColor={memoThemeColor}
                themeChromeAlphaMult={themeChromeAlphaMult}
                rowTintSourceColor={activeMemoFileItem?.color}
                readOnly={activeMemoReadOnly}
              />
            ) : (
              <div className="h-9 w-full" aria-hidden />
            )}
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
            onMouseDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest('[data-geo-block="note-node"]')) return;
              if (t.closest("[data-geo-editor-root]")) return;
              if (t.closest("[data-geo-node-context-menu]")) return;
              if (t.closest("[contenteditable]")) return;
              if (t.closest("button, input, textarea, a")) return;
              setSelectedIds([]);
              selectionAnchorRef.current = null;
            }}
          >
          <div key={activeMemoId} className={cn(
            "mx-auto w-full max-w-[var(--editor-max-width)] px-4 pb-10 pt-4 sm:px-5 md:px-6 md:pb-12 md:pt-6",
            effectiveSelectionMode && "cursor-cell select-none",
          )} style={{ fontSize: "var(--editor-font-size)", fontFamily: "var(--editor-font-family)" }}>

            {/* ── Breadcrumbs (visible only in focus mode) ── */}
            {focusedPath && (
              <div className="mb-4 flex flex-wrap items-center gap-1 font-mono text-[10px] tracking-wide">
                {/* Memo root crumb */}
                <button
                  type="button"
                  onClick={() => handleUnfocus(null)}
                  className="text-zinc-500 transition-colors hover:text-cyan-400"
                >
                  {activeMemo.title || t("app.memoTitlePlaceholder")}
                </button>

                {focusedPath.map((crumb, i) => {
                  const isLast = i === focusedPath.length - 1;
                  return (
                    <span key={crumb.id} className="flex items-center gap-1">
                      <span className="text-zinc-700">›</span>
                      {isLast ? (
                        <span className="text-zinc-300">{crumbLabel(crumb)}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUnfocus(crumb.id)}
                          className="max-w-[120px] truncate text-zinc-500 transition-colors hover:text-cyan-400"
                        >
                          {crumbLabel(crumb)}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* ── Memo title OR focused-node editable header ── */}
            {focusedPath ? (
              <div className="mb-4 border-l-2 border-cyan-500/50 pl-3">
                {focusedNodeSnapshot?.pluginData ? (
                  <div className="font-mono text-xl font-medium leading-snug text-violet-200/90">
                    {focusedNodeSnapshot.pluginData.name.trim() || (
                      <span className="italic text-zinc-600">{t("app.pluginCardEmpty")}</span>
                    )}
                  </div>
                ) : focusedNodeSnapshot?.gameData ? (
                  <div className="font-mono text-xl font-medium leading-snug text-amber-200/85">
                    {focusedNodeSnapshot.gameData.name.trim() || (
                      <span className="italic text-zinc-600">{t("app.specCardEmpty")}</span>
                    )}
                  </div>
                ) : (
                <div
                  ref={focusedHeaderRef}
                  contentEditable={!effectiveSelectionMode && !activeMemoReadOnly}
                  suppressContentEditableWarning
                  data-geo-editor="focus-title"
                  data-ph={t("app.focusNodeTitlePh")}
                  className="font-mono text-xl font-medium outline-none empty:before:text-zinc-600 empty:before:italic [&:empty]:before:content-[attr(data-ph)]"
                  style={{
                    color: EDITOR_STANDARD_TEXT_COLOR,
                    caretColor: EDITOR_STANDARD_CARET_COLOR,
                  }}
                  onInput={(e) => {
                    if (focusedNodeId)
                      setNodeContent(focusedNodeId, (e.currentTarget as HTMLDivElement).innerHTML);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (focusedNodeId) addChild(focusedNodeId);
                    }
                  }}
                />
                )}
              </div>
            ) : (
              <input
                ref={titleRef}
                type="text"
                value={activeMemo.title}
                readOnly={effectiveSelectionMode || activeMemoReadOnly}
                onChange={(e) => updateMemoTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  addRootNode();
                }}
                placeholder={t("app.memoTitlePlaceholder")}
                style={{
                  color: EDITOR_STANDARD_TEXT_COLOR,
                  caretColor: EDITOR_STANDARD_CARET_COLOR,
                }}
                className="mb-6 w-full bg-transparent font-mono text-3xl font-bold outline-none placeholder:text-zinc-700"
              />
            )}

            <div
              data-geo-editor-root
              className="relative min-h-[45vh] pb-8"
              onMouseDown={(e) => {
                const t = e.target as HTMLElement;
                const blockSel =
                  e.altKey || useMobileUiStore.getState().isMobileSelectionMode;
                if (!blockSel) return;
                if (t.closest('[data-geo-block="note-node"]')) return;
                if (t.closest("[contenteditable]")) return;
                if (t.closest("button, input, textarea, a")) return;
                if (e.button !== 0) return;
                const x = e.clientX;
                const y = e.clientY;
                isMarqueeRef.current = true;
                marqueeOriginRef.current = { x, y };
                setMarqueeRect({ left: x, top: y, width: 0, height: 0 });
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <NodeList
                memoType={activeMemo.memoType}
                themeColor={memoThemeColor}
                themeChromeAlphaMult={themeChromeAlphaMult}
                nodes={displayNodes}
                onActive={(id, editor) => {
                  setActiveId(id);
                  activeEditorRef.current = editor;
                  if (effectiveSelectionMode) return;
                  setSelectedIds((prev) => {
                    if (prev.length === 0) return prev;
                    if (prev.includes(id)) return prev;
                    selectionAnchorRef.current = null;
                    return [];
                  });
                }}
                onUpdate={setNodeContent}
                onToggleCollapsed={toggleCollapsed}
                onAddChild={addChild}
                onAddSibling={addSibling}
                onIndent={handleIndent}
                onUnindent={handleUnindent}
                onToggleCompleted={toggleCompleted}
                onToggleHasCheckbox={toggleHasCheckbox}
                onToggleNote={toggleNote}
                onSetNote={setNote}
                onSetBgColor={handleSetBgColor}
                onSetHeading={handleSetHeading}
                onPatchNodeContents={patchActiveNodeContents}
                onSetNodeImageUrl={setNodeImageUrl}
                onMemoColorSliderUndoGestureStart={beginMemoColorSliderUndoGesture}
                onMemoColorSliderUndoGestureEnd={endMemoColorSliderUndoGesture}
                onDelete={removeNode}
                onDeleteEmpty={deleteNodeAndFocusPrev}
                onFocusNode={handleFocusNode}
                selectedIds={selectedIds}
                isSelectionMode={effectiveSelectionMode}
                editorReadOnly={activeMemoReadOnly}
                onSelectStart={handleBlockSelectMouseDown}
                onMobileSelectNode={handleMobileSelectNode}
                onPatchPluginData={patchNodePluginData}
                onPatchGameData={patchNodeGameData}
                onConvertToPluginCard={convertNodeToPluginCard}
                onConvertToGameSpecCard={convertNodeToGameSpecCard}
              />
            </div>
          </div>
        </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggleMobileSelectionMode()}
        title={t("mobile.selectionModeHint")}
        aria-pressed={isMobileSelectionMode}
        aria-label={t("mobile.selectionMode")}
        className={cn(
          "fixed bottom-20 right-4 z-[88] flex h-12 w-12 touch-manipulation items-center justify-center rounded-md border shadow-[0_8px_30px_rgba(0,0,0,0.4)] md:hidden",
          isMobileSelectionMode
            ? "border-cyan-400/55 bg-cyan-950/45 text-cyan-200 shadow-cyan-500/15"
            : "border-zinc-600/80 bg-zinc-900/95 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200",
        )}
      >
        <MousePointer2 size={22} strokeWidth={1.75} />
      </button>

      <CloudSyncIndicator
        phase={cloudSync.phase}
        message={cloudSync.message}
        remoteEnabled={cloudSync.remoteEnabled}
      />
    </div>
  );
}
