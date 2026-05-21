"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { matchesKeybind } from "@/config/keybinds";
import NodeContextMenu from "@/components/Editor/NodeContextMenu";
import { PluginNodeCard } from "@/components/Editor/PluginNodeCard";
import { GameSpecNodeCard } from "@/components/Editor/GameSpecNodeCard";
import {
  musicLyricNonWhitespaceCountFromElement,
  musicLyricNonWhitespaceCountFromHtml,
} from "@/lib/musicLyricCount";
import { cn } from "@/lib/utils";
import {
  EDITOR_STANDARD_TEXT_COLOR,
  EDITOR_STANDARD_CARET_COLOR,
  EDITOR_NOTE_TEXT_COLOR,
  EDITOR_NOTE_CARET_COLOR,
  EDITOR_COMPLETED_TEXT_COLOR,
  EDITOR_COMPLETED_CARET_COLOR,
  getSolidThemeColor,
  themeChromeRgba,
  isThemeChromeInvisible,
} from "@/lib/memoThemeColor";
import type { MemoType } from "@/types/memoKind";
import type { NoteNode as NoteNodeType, NotePluginData, NoteGameData } from "@/types/note";
import { useSettings } from "@/contexts/SettingsContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { uploadFreaviaImageToStorage } from "@/lib/freaviaImageUpload";

function editorBodyClassNames(node: NoteNodeType): string {
  const { completed, headingLevel } = node;
  if (completed) return "line-through";
  if (headingLevel === "h1") return "text-lg font-medium";
  if (headingLevel === "h2") return "text-base font-medium";
  if (headingLevel === "h3") return "text-[13px] font-medium";
  return "";
}

function editorBodyColorStyle(node: NoteNodeType): CSSProperties | undefined {
  if (node.completed) {
    return { color: EDITOR_COMPLETED_TEXT_COLOR, caretColor: EDITOR_COMPLETED_CARET_COLOR };
  }
  return { color: EDITOR_STANDARD_TEXT_COLOR, caretColor: EDITOR_STANDARD_CARET_COLOR };
}

function noteEditorColorStyle(themeColor: string, chromeAlphaMult: number): CSSProperties {
  if (isThemeChromeInvisible(chromeAlphaMult)) {
    return {
      color: EDITOR_NOTE_TEXT_COLOR,
      caretColor: EDITOR_NOTE_CARET_COLOR,
      borderLeftColor: "transparent",
      borderLeftWidth: 0,
    };
  }
  return {
    color: EDITOR_NOTE_TEXT_COLOR,
    caretColor: EDITOR_NOTE_CARET_COLOR,
    borderLeftColor: themeChromeRgba(themeColor, 0.42, chromeAlphaMult),
  };
}

type SavedSelection = {
  node: globalThis.Node;
  offset: number;
};

export type NoteNodeProps = {
  node: NoteNodeType;
  depth: number;
  onActive: (id: string, editor: HTMLDivElement | null) => void;
  onUpdate: (id: string, content: string) => void;
  onToggleCollapsed: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onIndent: (id: string) => void;
  onUnindent: (id: string) => void;
  onToggleCompleted: (id: string) => void;
  onToggleHasCheckbox: (id: string) => void;
  onToggleNote: (id: string) => void;
  onSetNote: (id: string, text: string) => void;
  onSetBgColor: (id: string, color: string | null, opts?: { skipHistory?: boolean }) => void;
  onSetHeading: (id: string, heading: NoteNodeType["headingLevel"]) => void;
  onDelete: (id: string) => void;
  onDeleteEmpty: (id: string) => void;
  onFocusNode: (id: string) => void;
  selectedIds?: string[];
  /** When true, selection highlight is suppressed (an ancestor is already selected and covers this subtree). */
  ancestorCoversSelection?: boolean;
  isSelectionMode?: boolean;
  onSelectStart?: (id: string, e: React.MouseEvent) => void;
  onMobileSelectNode?: (id: string) => void;
  /** Mobile-only: full-row tap catcher while choosing nodes (does not affect Alt+desktop marquee). */
  mobileTapToggleOverlay?: boolean;
  /** When `"music"`, shows per-line non-whitespace character count for lyrics. */
  memoType?: MemoType;
  onPatchPluginData?: (
    id: string,
    patch: Partial<NotePluginData>,
    historyMode?: "immediate" | "none",
  ) => void;
  onPatchGameData?: (
    id: string,
    patch: Partial<NoteGameData>,
    historyMode?: "immediate" | "none",
  ) => void;
  onConvertToPluginCard?: (id: string) => void;
  /** Memo theme accent for bullets, cards, mode-adjacent chrome (not body text). */
  themeColor: string;
  /** 0–1 from sidebar tint alpha; fades borders/glows while keeping hue for text. */
  themeChromeAlphaMult?: number;
  onConvertToGameSpecCard?: (id: string) => void;
  onMemoColorSliderUndoGestureStart?: () => void;
  onMemoColorSliderUndoGestureEnd?: () => void;
  /** Batch sync note bodies after multi-target TEXT formatting in context menu. */
  onPatchNodeContents: (patches: Record<string, string>) => void;
  /** Supabase public URL for row attachment image (persisted on node). */
  onSetNodeImageUrl: (id: string, url: string | null) => void;
  /** Shared viewer: disable body / note editing (.images paste still allowed only if false). */
  editorReadOnly?: boolean;
  /** Hide ⋮ popup / long-press context menu on compact screens (replaced by mobile editor bar). */
  suppressFloatingContextMenu?: boolean;
};

const getCaretCharOffset = (el: HTMLElement): number => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
};

const setCaretToOffset = (el: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let textNode: Node | null;
  while ((textNode = walker.nextNode())) {
    const len = textNode.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= len;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
};

const insertImageAtSelection = (editor: HTMLDivElement, src: string) => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    editor.focus();
  }

  const activeSelection = window.getSelection();
  if (!activeSelection || activeSelection.rangeCount === 0) {
    return;
  }

  const range = activeSelection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return;
  }

  const image = document.createElement("img");
  image.src = src;
  image.alt = "pasted";
  image.className = "my-2 block max-h-48 w-auto max-w-full rounded-md object-contain";

  range.insertNode(image);
  range.setStartAfter(image);
  range.collapse(true);
  activeSelection.removeAllRanges();
  activeSelection.addRange(range);
};

export default function NoteNode({
  node,
  depth,
  onActive,
  onUpdate,
  onToggleCollapsed,
  onAddChild,
  onAddSibling,
  onIndent,
  onUnindent,
  onToggleCompleted,
  onToggleHasCheckbox,
  onToggleNote,
  onSetNote,
  onSetBgColor,
  onSetHeading,
  onDelete,
  onDeleteEmpty,
  onFocusNode,
  selectedIds = [],
  ancestorCoversSelection = false,
  isSelectionMode = false,
  onSelectStart,
  onMobileSelectNode,
  memoType = "standard",
  onPatchPluginData,
  onPatchGameData,
  onConvertToPluginCard,
  themeColor,
  themeChromeAlphaMult = 1,
  onConvertToGameSpecCard,
  onMemoColorSliderUndoGestureStart,
  onMemoColorSliderUndoGestureEnd,
  onPatchNodeContents,
  onSetNodeImageUrl,
  editorReadOnly = false,
  suppressFloatingContextMenu = false,
  mobileTapToggleOverlay = false,
}: NoteNodeProps) {
  const chrome = themeChromeAlphaMult;
  const hideThemedChrome = isThemeChromeInvisible(chrome);
  const solidAccent = getSolidThemeColor(themeColor, EDITOR_STANDARD_TEXT_COLOR);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const textBatchTargetIds = useMemo(
    () => (selectedIds.length >= 2 ? selectedIds : [node.id]),
    [selectedIds, node.id],
  );
  const isSelected = selectedSet.has(node.id);
  const showBlockHighlight = isSelected && !ancestorCoversSelection;
  const childAncestorCovers = ancestorCoversSelection || isSelected;
  // Pull live keybinds from settings context
  const { settings } = useSettings();
  const KEYBINDS = settings.keymap;

  const editorRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const contentRowRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const noteComposingRef = useRef(false);
  const savedSelectionRef = useRef<SavedSelection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  /** During IME composition, `node.content` lags; mirror count from the live editor. */
  const [musicLyricLiveCount, setMusicLyricLiveCount] = useState<number | null>(null);

  const hasChildren = node.children.length > 0;
  const isPluginCard = Boolean(node.pluginData);
  const isGameSpecCard = Boolean(node.gameData);
  const showMusicLyricCount = memoType === "music" && !isPluginCard && !isGameSpecCard;
  const musicLyricCommittedCount = useMemo(
    () => (showMusicLyricCount ? musicLyricNonWhitespaceCountFromHtml(node.content) : 0),
    [node.content, showMusicLyricCount],
  );
  const musicLyricDisplayCount = showMusicLyricCount
    ? (musicLyricLiveCount ?? musicLyricCommittedCount)
    : 0;

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightboxSrc) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [lightboxSrc]);

  // Close menu when the editor area is scrolled (prevents stale fixed position).
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => { setMenuOpen(false); setIsHovered(false); };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close, { passive: true });
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const saveCaretPosition = (el: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return;

    savedSelectionRef.current = {
      node: range.startContainer,
      offset: range.startOffset,
    };
  };

  const restoreCaretPosition = () => {
    const saved = savedSelectionRef.current;
    if (!saved) return;
    const sel = window.getSelection();
    if (!sel) return;
    try {
      const range = document.createRange();
      range.setStart(saved.node, saved.offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      //
    }
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el || node.pluginData || node.gameData || isComposingRef.current) return;
    if (el.innerHTML === node.content) return;

    const focused = document.activeElement === el;
    if (focused) {
      saveCaretPosition(el);
      el.innerHTML = node.content;
      restoreCaretPosition();
      return;
    }

    el.innerHTML = node.content;
  }, [node.content, node.pluginData, node.gameData]);

  useEffect(() => {
    const el = noteRef.current;
    if (!el || noteComposingRef.current) return;
    if (node.note === null) return;
    if (el.textContent === node.note) return;
    el.textContent = node.note;
  }, [node.note]);

  const pushContentFromEditor = useCallback(
    (el: HTMLElement) => {
      onUpdate(node.id, el.innerHTML);
    },
    [node.id, onUpdate],
  );

  const processImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const editor = editorRef.current;
      const fallbackInline = () => {
        if (!editor) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            insertImageAtSelection(editor, reader.result);
            onUpdate(node.id, editor.innerHTML);
          }
        };
        reader.readAsDataURL(file);
      };
      const client = getSupabaseBrowserClient();
      if (!client) {
        fallbackInline();
        return;
      }
      setImageUploading(true);
      try {
        const url = await uploadFreaviaImageToStorage(client, file);
        onSetNodeImageUrl(node.id, url);
      } catch (err) {
        console.error(err);
        fallbackInline();
      } finally {
        setImageUploading(false);
      }
    },
    [node.id, onSetNodeImageUrl, onUpdate],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposingRef.current) return;
    if (editorReadOnly) return;

    if (e.key === "Backspace") {
      const el = editorRef.current;
      if (el && el.textContent === "" && !el.querySelector("img") && !node.imageUrl) {
        e.preventDefault();
        // Only delete leaf nodes – never delete a node that still has children
        if (node.children && node.children.length > 0) return;
        onDeleteEmpty(node.id);
        return;
      }
    }

    if (matchesKeybind(e, KEYBINDS.INDENT)) {
      e.preventDefault();
      const caretOffset = editorRef.current ? getCaretCharOffset(editorRef.current) : 0;
      const nodeId = node.id;
      onIndent(nodeId);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-node-id="${nodeId}"] [data-geo-editor="body"]`,
        );
        if (!el) return;
        el.focus();
        setCaretToOffset(el, caretOffset);
      });
      return;
    }
    if (matchesKeybind(e, KEYBINDS.UNINDENT)) {
      e.preventDefault();
      const caretOffset = editorRef.current ? getCaretCharOffset(editorRef.current) : 0;
      const nodeId = node.id;
      onUnindent(nodeId);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-node-id="${nodeId}"] [data-geo-editor="body"]`,
        );
        if (!el) return;
        el.focus();
        setCaretToOffset(el, caretOffset);
      });
      return;
    }
    if (matchesKeybind(e, KEYBINDS.SOFT_BREAK)) {
      // Shift+Enter → soft line break inside the node
      e.preventDefault();
      document.execCommand("insertLineBreak");
      if (editorRef.current) pushContentFromEditor(editorRef.current);
      return;
    }
    if (matchesKeybind(e, KEYBINDS.ADD_SIBLING)) {
      // Enter → add sibling node
      e.preventDefault();
      onAddSibling(node.id);
      return;
    }
  };

  const openMenu = () => {
    if (suppressFloatingContextMenu) return;
    const rect = contentRowRef.current?.getBoundingClientRect();
    if (rect) setMenuAnchorRect(rect);
    setMenuOpen(true);
  };

  const openMenuAtPointer = (clientX: number, clientY: number) => {
    if (suppressFloatingContextMenu) return;
    // Build a synthetic DOMRect anchored to the mouse pointer
    const fakeRect = {
      left: clientX - 20,
      bottom: clientY,
      top: clientY,
      right: clientX,
      width: 0,
      height: 0,
      x: clientX - 20,
      y: clientY,
      toJSON: () => ({}),
    } as DOMRect;
    setMenuAnchorRect(fakeRect);
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setIsHovered(false);
  };

  return (
    <div
      className={cn("w-full overflow-visible rounded-sm", isSelectionMode && "select-none")}
      data-geo-block="note-node"
      data-node-id={node.id}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { if (!menuOpen) setIsHovered(false); }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        if (!e.altKey && !isSelectionMode) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectStart?.(node.id, e);
      }}
    >
      {/* Highlight only this node's row (+ note strip), not nested child nodes (avoids "whole subtree" box). */}
      <div
        className={cn(
          "relative rounded-sm",
          showBlockHighlight && "bg-cyan-500/20 ring-1 ring-inset ring-cyan-500/40",
        )}
      >
        {mobileTapToggleOverlay && isSelectionMode && !!onMobileSelectNode && (
          <div
            className="absolute inset-0 z-[25] touch-none rounded-sm"
            aria-hidden
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDownCapture={(e: PointerEvent<HTMLDivElement>) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              const stack = document.elementsFromPoint(e.clientX, e.clientY);
              const hitsChromeButton = stack.some(
                (el) =>
                  el instanceof HTMLElement &&
                  (el.closest("button") !== null || el.closest('[role="button"]') !== null),
              );
              if (hitsChromeButton) return;
              e.preventDefault();
              e.stopPropagation();
              if (editorReadOnly) return;
              onMobileSelectNode(node.id);
            }}
          />
        )}
        <div ref={contentRowRef} className="relative w-full overflow-visible">
          <div
            className={cn(
              "relative z-10 -mx-2 flex w-full min-w-0 items-start overflow-visible rounded-md px-2 py-0.5",
              "bg-transparent transition-colors duration-150 ease-in-out",
              !node.bgColor && !isPluginCard && !isGameSpecCard && "hover:bg-white/10",
              (isPluginCard || isGameSpecCard) &&
                "hover:ring-2 hover:ring-inset hover:ring-white/15",
            )}
          >
          <div
            className={cn(
              "absolute left-0 top-1/2 flex -translate-x-full -translate-y-1/2 items-center px-0.5 transition-opacity duration-150",
              suppressFloatingContextMenu && "hidden md:flex",
              isHovered || menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <button
              type="button"
              disabled={editorReadOnly}
              onClick={() => {
                if (editorReadOnly) return;
                menuOpen ? closeMenu() : openMenu();
              }}
              className="flex h-6 w-6 items-center justify-center text-sm text-zinc-500 transition-colors hover:enabled:bg-zinc-800 hover:enabled:text-zinc-200 active:enabled:scale-90 disabled:opacity-30"
              aria-label="ノードメニュー"
            >
              ⋮
            </button>
          </div>

          <div
            className={cn(
              "relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col rounded-md px-3 py-0.5",
              !node.bgColor && "bg-transparent",
              node.bgColor &&
                !isPluginCard &&
                !isGameSpecCard &&
                "transition-[box-shadow] duration-150 ease-in-out hover:ring-2 hover:ring-inset hover:ring-zinc-400/45",
            )}
            style={{ backgroundColor: node.bgColor ?? undefined }}
            onDragOver={
              !isPluginCard && !isGameSpecCard && !isSelectionMode && !editorReadOnly
                ? (e) => {
                    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }
                : undefined
            }
            onDrop={
              !isPluginCard && !isGameSpecCard && !isSelectionMode && !editorReadOnly
                ? (e) => {
                    e.preventDefault();
                    const file = Array.from(e.dataTransfer.files).find((f) =>
                      f.type.startsWith("image/"),
                    );
                    if (file) void processImageFile(file);
                  }
                : undefined
            }
          >
            <div className="flex min-h-0 min-w-0 w-full items-start gap-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleCollapsed(node.id)}
                className={cn(
                  "mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center border bg-zinc-900 transition-all hover:bg-zinc-800 active:scale-90",
                )}
                style={{
                  borderColor: solidAccent,
                  color: solidAccent,
                }}
                aria-expanded={!node.collapsed}
                aria-label={node.collapsed ? "展開" : "折りたたむ"}
              >
                <svg
                  className={cn(
                    "h-2 w-2 shrink-0 transition-transform duration-150",
                    !node.collapsed && "rotate-90",
                  )}
                  viewBox="0 0 8 8"
                  aria-hidden
                >
                  <polygon points="1,1 7,4 1,7" fill={solidAccent} />
                </svg>
              </button>
            ) : (
              <div className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full border",
                  )}
                  style={{
                    borderColor: solidAccent,
                    backgroundColor: "transparent",
                  }}
                  aria-hidden
                />
              </div>
            )}

            {node.hasCheckbox && (
              <button
                type="button"
                onClick={() => onToggleCompleted(node.id)}
                className={cn(
                  "mt-1.5 mr-0.5 flex h-3 w-3 shrink-0 items-center justify-center border transition-colors",
                )}
                style={{
                  borderColor: solidAccent,
                }}
                aria-label={node.completed ? "完了を解除" : "完了にする"}
              >
                {node.completed && (
                  <span
                    className="text-[8px] leading-none"
                    style={{ color: solidAccent }}
                  >
                    ✓
                  </span>
                )}
              </button>
            )}

            {isPluginCard && node.pluginData && onPatchPluginData ? (
              <div
                className={cn(
                  "min-w-0 flex-1",
                  isSelectionMode && mobileTapToggleOverlay && "pointer-events-none touch-none",
                )}
                onFocusCapture={() => onActive(node.id, null)}
                onContextMenu={(e) => {
                  if (suppressFloatingContextMenu) {
                    e.preventDefault();
                    return;
                  }
                  if (editorReadOnly) return;
                  e.preventDefault();
                  openMenuAtPointer(e.clientX, e.clientY);
                }}
              >
                <PluginNodeCard
                  node={node as NoteNodeType & { pluginData: NotePluginData }}
                  keybinds={KEYBINDS}
                  accentColor={solidAccent}
                  chromeAlphaMult={chrome}
                  readOnly={editorReadOnly}
                  onPatch={(patch, mode) => onPatchPluginData(node.id, patch, mode)}
                  onAddSibling={() => onAddSibling(node.id)}
                  onIndent={() => {
                    const nid = node.id;
                    onIndent(nid);
                    requestAnimationFrame(() => {
                      document
                        .querySelector<HTMLElement>(`[data-node-id="${nid}"] [data-card-focus-target="name"]`)
                        ?.focus();
                    });
                  }}
                  onUnindent={() => {
                    const nid = node.id;
                    onUnindent(nid);
                    requestAnimationFrame(() => {
                      document
                        .querySelector<HTMLElement>(`[data-node-id="${nid}"] [data-card-focus-target="name"]`)
                        ?.focus();
                    });
                  }}
                  onDeleteEmpty={() => onDeleteEmpty(node.id)}
                />
              </div>
            ) : isGameSpecCard && node.gameData && onPatchGameData ? (
              <div
                className={cn(
                  "min-w-0 flex-1",
                  isSelectionMode && mobileTapToggleOverlay && "pointer-events-none touch-none",
                )}
                onFocusCapture={() => onActive(node.id, null)}
                onContextMenu={(e) => {
                  if (suppressFloatingContextMenu) {
                    e.preventDefault();
                    return;
                  }
                  if (editorReadOnly) return;
                  e.preventDefault();
                  openMenuAtPointer(e.clientX, e.clientY);
                }}
              >
                <GameSpecNodeCard
                  node={node as NoteNodeType & { gameData: NoteGameData }}
                  keybinds={KEYBINDS}
                  accentColor={solidAccent}
                  readOnly={editorReadOnly}
                  chromeAlphaMult={chrome}
                  onPatch={(patch, mode) => onPatchGameData(node.id, patch, mode)}
                  onAddSibling={() => onAddSibling(node.id)}
                  onIndent={() => {
                    const nid = node.id;
                    onIndent(nid);
                    requestAnimationFrame(() => {
                      document
                        .querySelector<HTMLElement>(`[data-node-id="${nid}"] [data-card-focus-target="name"]`)
                        ?.focus();
                    });
                  }}
                  onUnindent={() => {
                    const nid = node.id;
                    onUnindent(nid);
                    requestAnimationFrame(() => {
                      document
                        .querySelector<HTMLElement>(`[data-node-id="${nid}"] [data-card-focus-target="name"]`)
                        ?.focus();
                    });
                  }}
                  onDeleteEmpty={() => onDeleteEmpty(node.id)}
                />
              </div>
            ) : (
            <div
              ref={editorRef}
              contentEditable={!isSelectionMode && !editorReadOnly}
              suppressContentEditableWarning
              data-node-id={node.id}
              data-geo-editor="body"
              className={cn(
                "min-h-[22px] flex-1 whitespace-pre-wrap break-words bg-transparent leading-relaxed outline-none",
                editorBodyClassNames(node),
                isSelectionMode && mobileTapToggleOverlay && "pointer-events-none touch-none select-none",
              )}
              style={editorBodyColorStyle(node)}
              onFocus={() => onActive(node.id, editorRef.current)}
              onCompositionStart={(e) => {
                isComposingRef.current = true;
                if (showMusicLyricCount) {
                  setMusicLyricLiveCount(musicLyricNonWhitespaceCountFromElement(e.currentTarget));
                }
              }}
              onCompositionUpdate={(e) => {
                if (!showMusicLyricCount) return;
                setMusicLyricLiveCount(musicLyricNonWhitespaceCountFromElement(e.currentTarget));
              }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                if (showMusicLyricCount) {
                  setMusicLyricLiveCount(null);
                }
                saveCaretPosition(e.currentTarget);
                pushContentFromEditor(e.currentTarget);
              }}
              onInput={(e) => {
                if (showMusicLyricCount) {
                  if (isComposingRef.current) {
                    setMusicLyricLiveCount(musicLyricNonWhitespaceCountFromElement(e.currentTarget));
                  } else {
                    setMusicLyricLiveCount(null);
                  }
                }
                if (isComposingRef.current) return;
                saveCaretPosition(e.currentTarget);
                pushContentFromEditor(e.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === "IMG") {
                  e.preventDefault();
                  setLightboxSrc((target as HTMLImageElement).src);
                }
              }}
              onContextMenu={(e) => {
                if (suppressFloatingContextMenu) {
                  e.preventDefault();
                  return;
                }
                if (editorReadOnly) return;
                e.preventDefault();
                openMenuAtPointer(e.clientX, e.clientY);
              }}
              onPaste={(event) => {
                if (editorReadOnly) return;
                const editor = editorRef.current;
                if (!editor) return;

                const items = Array.from(event.clipboardData.items);
                const imageItem = items.find((item) => item.type.startsWith("image/"));
                if (!imageItem) return;

                event.preventDefault();
                const file = imageItem.getAsFile();
                if (!file) return;
                void processImageFile(file);
              }}
            />
            )}
            {showMusicLyricCount && musicLyricDisplayCount > 0 && (
              <span
                className="pointer-events-none shrink-0 self-center select-none tabular-nums text-xs text-zinc-500/50"
                aria-hidden
              >
                {musicLyricDisplayCount}
              </span>
            )}
            </div>

            {!isPluginCard && !isGameSpecCard && (!!node.imageUrl || imageUploading) && (
              <div className="group relative mt-2 w-fit max-w-full shrink-0 self-start">
                {imageUploading && (
                  <div className="flex items-center gap-2 rounded-md border border-cyan-500/35 bg-zinc-950/90 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]">
                    <span
                      className="inline-block h-2.5 w-2.5 animate-pulse rounded-sm bg-cyan-400/70 shadow-[0_0_10px_rgba(34,211,238,0.45)]"
                      aria-hidden
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-400/75">
                      Uploading…
                    </span>
                  </div>
                )}
                {node.imageUrl && !imageUploading && (
                  <div className="relative w-fit max-w-full">
                    <button
                      type="button"
                      className="block w-fit max-w-full cursor-zoom-in rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                      onClick={() => setLightboxSrc(node.imageUrl!)}
                    >
                      <img
                        src={node.imageUrl}
                        alt=""
                        className="max-h-48 w-auto max-w-full rounded-md object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                    <button
                      type="button"
                      className="absolute right-2 top-2 z-[2] rounded-md bg-black/50 p-1 font-mono text-[11px] leading-none text-white opacity-0 shadow-sm transition-opacity duration-150 hover:bg-black/65 group-hover:opacity-100"
                      aria-label="画像を削除"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSetNodeImageUrl(node.id, null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>

        {menuOpen && !suppressFloatingContextMenu && menuAnchorRect && (
          <NodeContextMenu
            node={node}
            anchorRect={menuAnchorRect}
            onClose={closeMenu}
            onIndent={() => onIndent(node.id)}
            onUnindent={() => onUnindent(node.id)}
            onToggleCollapsed={() => onToggleCollapsed(node.id)}
            onToggleHasCheckbox={() => onToggleHasCheckbox(node.id)}
            onToggleCompleted={() => onToggleCompleted(node.id)}
            onAddChild={() => onAddChild(node.id)}
            onAddSibling={() => onAddSibling(node.id)}
            onToggleNote={() => onToggleNote(node.id)}
            onSetBgColor={(c, o) => onSetBgColor(node.id, c, o)}
            onSetHeading={(h) => onSetHeading(node.id, h)}
            onDelete={() => onDelete(node.id)}
            onFocusNode={() => onFocusNode(node.id)}
            memoType={memoType}
            onMemoColorSliderUndoGestureStart={onMemoColorSliderUndoGestureStart}
            onMemoColorSliderUndoGestureEnd={onMemoColorSliderUndoGestureEnd}
            textBatchTargetIds={textBatchTargetIds}
            onPatchNodeContents={onPatchNodeContents}
            onTurnIntoPlugin={
              memoType === "music" && !node.pluginData && !node.gameData && onConvertToPluginCard
                ? () => onConvertToPluginCard(node.id)
                : undefined
            }
            onTurnIntoGameSpec={
              memoType === "gamedev" && !node.pluginData && !node.gameData && onConvertToGameSpecCard
                ? () => onConvertToGameSpecCard(node.id)
                : undefined
            }
          />
        )}

      {node.note !== null && (
        <div
          className="-mx-0.5 rounded-md py-0.5 pl-1 pr-2 text-[11px] transition-colors duration-150 ease-in-out hover:bg-zinc-800/45 hover:bg-white/[0.035]"
          style={{ paddingLeft: "20px" }}
        >
          <div
            ref={noteRef}
            contentEditable={!isSelectionMode && !editorReadOnly}
            suppressContentEditableWarning
            data-geo-editor="node-note"
            aria-label="ノート"
            className={cn(
              "border-l bg-transparent pb-1 pl-2 pt-0.5 italic outline-none",
              hideThemedChrome && "border-l-0",
              isSelectionMode && mobileTapToggleOverlay && "pointer-events-none touch-none select-none",
            )}
            style={noteEditorColorStyle(themeColor, chrome)}
            onFocus={() => onActive(node.id, noteRef.current)}
            onCompositionStart={() => {
              noteComposingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              noteComposingRef.current = false;
              onSetNote(node.id, e.currentTarget.textContent ?? "");
            }}
            onInput={(e) => {
              if (noteComposingRef.current) return;
              onSetNote(node.id, e.currentTarget.textContent ?? "");
            }}
            onBlur={(e) => onSetNote(node.id, e.currentTarget.textContent ?? "")}
          />
        </div>
      )}

      </div>

      {hasChildren && (
        <div className="relative" style={{ paddingLeft: "20px" }}>
          {/* Indent guideline – vertical cyber line, aligned with toggle button */}
          <div
            className="pointer-events-none absolute left-[1px] w-px transition-all duration-300"
            style={{
              top: 0,
              bottom: node.collapsed ? "auto" : 0,
              height: node.collapsed ? "6px" : "auto",
              backgroundColor: isHovered
                ? themeChromeRgba(themeColor, 0.28, chrome)
                : "rgba(63, 63, 70, 0.38)",
              boxShadow: isHovered && !node.collapsed
                ? `0 0 6px ${themeChromeRgba(themeColor, 0.22, chrome)}`
                : "none",
            }}
          />

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              node.collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            )}
          >
            <div className="overflow-hidden">
              {node.children.map((child) => (
                <NoteNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  onActive={onActive}
                  onUpdate={onUpdate}
                  onToggleCollapsed={onToggleCollapsed}
                  onAddChild={onAddChild}
                  onAddSibling={onAddSibling}
                  onIndent={onIndent}
                  onUnindent={onUnindent}
                  onToggleCompleted={onToggleCompleted}
                  onToggleHasCheckbox={onToggleHasCheckbox}
                  onToggleNote={onToggleNote}
                  onSetNote={onSetNote}
                  onSetBgColor={onSetBgColor}
                  onSetHeading={onSetHeading}
                  onDelete={onDelete}
                  onDeleteEmpty={onDeleteEmpty}
                  onFocusNode={onFocusNode}
                  selectedIds={selectedIds}
                  ancestorCoversSelection={childAncestorCovers}
                  isSelectionMode={isSelectionMode}
                  editorReadOnly={editorReadOnly}
                  onSelectStart={onSelectStart}
                  onMobileSelectNode={onMobileSelectNode}
                  memoType={memoType}
                  onPatchPluginData={onPatchPluginData}
                  onPatchGameData={onPatchGameData}
                  onConvertToPluginCard={onConvertToPluginCard}
                  themeColor={themeColor}
                  themeChromeAlphaMult={chrome}
                  onConvertToGameSpecCard={onConvertToGameSpecCard}
                  onMemoColorSliderUndoGestureStart={onMemoColorSliderUndoGestureStart}
                  onMemoColorSliderUndoGestureEnd={onMemoColorSliderUndoGestureEnd}
                  onPatchNodeContents={onPatchNodeContents}
                  onSetNodeImageUrl={onSetNodeImageUrl}
                  suppressFloatingContextMenu={suppressFloatingContextMenu}
                  mobileTapToggleOverlay={mobileTapToggleOverlay}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox overlay ── */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal
          aria-label="画像の拡大表示"
          className="fixed inset-0 z-[10000] flex cursor-zoom-out items-center justify-center bg-black/88 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center border border-zinc-700 bg-zinc-900/80 font-mono text-sm text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-100"
            aria-label="閉じる"
          >
            ✕
          </button>
          <img
            src={lightboxSrc}
            alt="拡大表示"
            className="max-h-[90vh] max-w-[90vw] cursor-default rounded border border-zinc-700/60 object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
