"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShareModalStore } from "@/stores/shareModalStore";
import { Share2, Paintbrush, X } from "lucide-react";
import { useTextFormatting, type FormatCommand } from "@/hooks/useTextFormatting";
import {
  applyFontSizeWholeBodies,
  applyForeColorWholeBodies,
  applyFormatWholeBodies,
  collectBodyHtmlPatches,
} from "@/lib/editorBatchFormat";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { attachChromeProofTap } from "@/lib/chromeProofPointerHandlers";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMobileUiStore } from "@/stores/mobileUiStore";

type FormatUiState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
};

const EMPTY_FORMAT: FormatUiState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
};

function readFormatStateFromEditor(el: HTMLElement | null): FormatUiState {
  if (!el || typeof document === "undefined" || !document.contains(el)) {
    return EMPTY_FORMAT;
  }
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return EMPTY_FORMAT;
  const node = sel.anchorNode;
  if (!node || !el.contains(node)) return EMPTY_FORMAT;
  try {
    return {
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
    };
  } catch {
    return EMPTY_FORMAT;
  }
}

type ToolbarProps = {
  isEditorActive: boolean;
  getActiveEditor: () => HTMLDivElement | null;
  onSyncActiveEditor: () => void;
  /** When length ≥ 2, inline formatting applies to all selected row bodies in one state update. */
  selectedIds?: string[];
  onPatchNodeContents?: (patches: Record<string, string>) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Active memo id (for Share and other memo-scoped actions). */
  activeMemoId: string;
  /** Shared viewer (or non-editor invitee): disable formatting and status controls. */
  readOnly?: boolean;
};

const clampSize = (size: number) => Math.min(72, Math.max(8, size));

function Separator() {
  return <div className="mx-1 h-4 w-px bg-zinc-700" />;
}

export default function Toolbar({
  isEditorActive,
  getActiveEditor,
  onSyncActiveEditor,
  selectedIds = [],
  onPatchNodeContents,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  activeMemoId,
  readOnly = false,
}: ToolbarProps) {
  const { t } = useTranslation();
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isMobileRichTextToolbarOpen = useMobileUiStore((s) => s.isMobileRichTextToolbarOpen);
  const toggleMobileRichTextToolbar = useMobileUiStore((s) => s.toggleMobileRichTextToolbar);
  const setMobileRichTextToolbarOpen = useMobileUiStore((s) => s.setMobileRichTextToolbarOpen);
  const formatToolbarToggleTap = useMemo(
    () => attachChromeProofTap({ onActivate: toggleMobileRichTextToolbar }),
    [toggleMobileRichTextToolbar],
  );
  const formatToolbarCloseTap = useMemo(
    () => attachChromeProofTap({ onActivate: () => setMobileRichTextToolbarOpen(false) }),
    [setMobileRichTextToolbarOpen],
  );
  const openShareModal = useShareModalStore((s) => s.openShareModal);
  const [fontSize, setFontSize] = useState(14);
  const {
    applyFormat,
    applyFontSize: applyExecFontSize,
    applyFontColor,
  } = useTextFormatting();

  const [formatUi, setFormatUi] = useState<FormatUiState>(EMPTY_FORMAT);

  const refreshFormatUi = useCallback(() => {
    if (!isEditorActive) {
      setFormatUi(EMPTY_FORMAT);
      return;
    }
    const ed = getActiveEditor();
    setFormatUi(readFormatStateFromEditor(ed));
  }, [isEditorActive, getActiveEditor]);

  useEffect(() => {
    if (!isEditorActive) {
      setFormatUi(EMPTY_FORMAT);
      return;
    }
    refreshFormatUi();
    const onSel = () => {
      requestAnimationFrame(refreshFormatUi);
    };
    document.addEventListener("selectionchange", onSel);
    window.addEventListener("mouseup", onSel);
    window.addEventListener("keyup", onSel);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      window.removeEventListener("mouseup", onSel);
      window.removeEventListener("keyup", onSel);
    };
  }, [isEditorActive, refreshFormatUi]);

  const batchTargetIds = useMemo(
    () => (selectedIds.length >= 2 ? selectedIds : null),
    [selectedIds],
  );

  const canEdit = useMemo(
    () => !readOnly && (Boolean(batchTargetIds) || isEditorActive),
    [readOnly, batchTargetIds, isEditorActive],
  );

  const commitBatchBodies = useCallback(
    (ids: string[]) => {
      const patches = collectBodyHtmlPatches(ids);
      if (Object.keys(patches).length > 0) {
        onPatchNodeContents?.(patches);
      }
    },
    [onPatchNodeContents],
  );

  const formatBtnClass = (active: boolean) =>
    cn(
      "h-6 min-w-6 border px-1 text-xs font-semibold disabled:opacity-40",
      active
        ? "border-cyan-500/60 bg-zinc-700 text-white ring-1 ring-inset ring-cyan-500/40"
        : "border-zinc-600 text-zinc-50 hover:enabled:border-zinc-400 hover:enabled:bg-zinc-900/80 hover:enabled:text-white",
    );

  const runCommand = (command: string, value?: string) => {
    if (batchTargetIds) {
      if (
        command === "bold" ||
        command === "italic" ||
        command === "underline" ||
        command === "strikeThrough"
      ) {
        applyFormatWholeBodies(batchTargetIds, command as FormatCommand);
        commitBatchBodies(batchTargetIds);
      } else if (command === "foreColor" && value) {
        applyForeColorWholeBodies(batchTargetIds, value);
        commitBatchBodies(batchTargetIds);
      }
      requestAnimationFrame(refreshFormatUi);
      return;
    }
    const activeEditor = getActiveEditor();
    if (!canEdit || !activeEditor) return;
    activeEditor.focus();
    if (
      command === "bold" ||
      command === "italic" ||
      command === "underline" ||
      command === "strikeThrough"
    ) {
      applyFormat(command);
    } else if (command === "foreColor" && value) {
      applyFontColor(value);
    } else {
      document.execCommand(command, false, value);
    }
    onSyncActiveEditor();
    requestAnimationFrame(refreshFormatUi);
  };

  const applyFontSize = (size: number) => {
    const normalized = clampSize(size);
    setFontSize(normalized);
    if (batchTargetIds) {
      applyFontSizeWholeBodies(batchTargetIds, normalized);
      commitBatchBodies(batchTargetIds);
      requestAnimationFrame(refreshFormatUi);
      return;
    }
    const activeEditor = getActiveEditor();
    if (!canEdit || !activeEditor) return;
    activeEditor.focus();
    applyExecFontSize(normalized);
    onSyncActiveEditor();
    requestAnimationFrame(refreshFormatUi);
  };

  const formatMain = (
    <>
      <button
        disabled={!canEdit}
        {...attachChromeProofTap({
          onActivate: () => runCommand("bold"),
          disabled: !canEdit,
        })}
        className={formatBtnClass(formatUi.bold)}
      >
        B
      </button>
      <button
        disabled={!canEdit}
        {...attachChromeProofTap({
          onActivate: () => runCommand("italic"),
          disabled: !canEdit,
        })}
        className={formatBtnClass(formatUi.italic)}
      >
        I
      </button>
      <button
        disabled={!canEdit}
        {...attachChromeProofTap({
          onActivate: () => runCommand("underline"),
          disabled: !canEdit,
        })}
        className={formatBtnClass(formatUi.underline)}
      >
        U
      </button>
      <button
        disabled={!canEdit}
        {...attachChromeProofTap({
          onActivate: () => runCommand("strikeThrough"),
          disabled: !canEdit,
        })}
        className={formatBtnClass(formatUi.strikeThrough)}
      >
        S
      </button>

      <Separator />

      <button
        disabled={!canEdit}
        {...attachChromeProofTap({
          onActivate: () => applyFontSize(fontSize - 1),
          disabled: !canEdit,
        })}
        className="h-6 min-w-6 border border-zinc-600 px-1 text-xs font-semibold text-zinc-50 disabled:opacity-40"
      >
        -
      </button>
      <input
        type="number"
        min={8}
        max={72}
        value={fontSize}
        disabled={readOnly}
        onChange={(event) => {
          const next = clampSize(Number(event.target.value) || 8);
          setFontSize(next);
          applyFontSize(next);
        }}
        className="h-6 w-12 border border-zinc-600 bg-zinc-800 text-center text-xs font-medium text-zinc-50 outline-none"
      />
      <button
        disabled={!canEdit}
        {...attachChromeProofTap({
          onActivate: () => applyFontSize(fontSize + 1),
          disabled: !canEdit,
        })}
        className="h-6 min-w-6 border border-zinc-600 px-1 text-xs font-semibold text-zinc-50 disabled:opacity-40"
      >
        +
      </button>
    </>
  );

  return (
    <div
      data-geo-editor-toolbar
      className="sticky top-0 z-50 flex min-w-0 shrink-0 flex-col border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-sm"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto px-2 py-1.5 sm:px-3">
        {!isMdUp && (
          <button
            aria-pressed={isMobileRichTextToolbarOpen}
            title={t("mobile.formatToolbarToggleHint")}
            aria-label={t("mobile.formatToolbarToggle")}
            {...formatToolbarToggleTap}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center border transition-colors",
              isMobileRichTextToolbarOpen
                ? "border-cyan-500/55 bg-cyan-950/40 text-cyan-200"
                : "border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-zinc-50",
            )}
          >
            <Paintbrush size={15} strokeWidth={2} className="shrink-0" />
          </button>
        )}

        {/* Undo / Redo */}
        <button
          title={t("toolbar.undo")}
          disabled={readOnly || !canUndo}
          {...attachChromeProofTap({
            onActivate: () => onUndo?.(),
            disabled: readOnly || !canUndo,
          })}
          className="flex h-6 w-6 items-center justify-center border border-zinc-700 text-xs text-zinc-200 disabled:opacity-30 hover:enabled:border-zinc-500 hover:enabled:text-zinc-50"
        >
          ↩
        </button>
        <button
          title={t("toolbar.redo")}
          disabled={readOnly || !canRedo}
          {...attachChromeProofTap({
            onActivate: () => onRedo?.(),
            disabled: readOnly || !canRedo,
          })}
          className="flex h-6 w-6 items-center justify-center border border-zinc-700 text-xs text-zinc-200 disabled:opacity-30 hover:enabled:border-zinc-500 hover:enabled:text-zinc-50"
        >
          ↪
        </button>

        {isMdUp && (
          <>
            <Separator />
            {formatMain}
            <Separator />
          </>
        )}

        <div
          className="ml-auto flex shrink-0 items-center gap-1.5"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title={t("toolbar.share")}
            aria-label={t("toolbar.share")}
            disabled={readOnly}
            {...attachChromeProofTap({
              onActivate: () => openShareModal(activeMemoId),
              disabled: readOnly,
            })}
            className="flex h-6 items-center gap-1 border border-zinc-700/90 bg-zinc-900/30 px-2 text-[10px] tracking-wide text-zinc-400 transition-colors hover:enabled:border-cyan-500/40 hover:enabled:bg-zinc-900/55 hover:enabled:text-cyan-200/90 disabled:opacity-40"
          >
            <Share2 size={12} strokeWidth={1.75} className="shrink-0 opacity-85" />
            <span className="max-[680px]:hidden">Share</span>
          </button>
        </div>
      </div>

      {!isMdUp && isMobileRichTextToolbarOpen && (
        <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto border-t border-zinc-800/50 px-2 py-1.5 sm:px-3">
          {formatMain}
          <button
            type="button"
            aria-label={t("mobile.formatToolbarClose")}
            title={t("mobile.formatToolbarClose")}
            {...formatToolbarCloseTap}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-700/90 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
