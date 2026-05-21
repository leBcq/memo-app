"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import { ToolbarUnifiedMemoStatusControl } from "@/components/MemoWorkflowMenu";
import { useShareModalStore } from "@/stores/shareModalStore";
import { Share2, Paintbrush } from "lucide-react";
import { useTextFormatting, type FormatCommand } from "@/hooks/useTextFormatting";
import {
  applyFontSizeWholeBodies,
  applyForeColorWholeBodies,
  applyFormatWholeBodies,
  collectBodyHtmlPatches,
} from "@/lib/editorBatchFormat";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMobileUiStore } from "@/stores/mobileUiStore";
import type { GamedevStage } from "@/types/gamedev";
import type { MemoType } from "@/types/memoKind";
import type { MemoWorkflowStatus } from "@/types/memoWorkflow";

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
  memoType: MemoType;
  workflowStatus: MemoWorkflowStatus;
  onWorkflowChange: (status: MemoWorkflowStatus) => void;
  gamedevStage?: GamedevStage;
  onGamedevStageChange?: (stage: GamedevStage) => void;
  /** Active memo id (for Share and other memo-scoped actions). */
  activeMemoId: string;
  /** Shared viewer (or non-editor invitee): disable formatting and status controls. */
  readOnly?: boolean;
};

const PRESET_COLORS = ["#a78bfa", "#60dfcd", "#f87171", "#fbbf24", "#e0e0e6"];

const clampSize = (size: number) => Math.min(72, Math.max(8, size));

function Separator() {
  return <div className="mx-1 h-4 w-px bg-zinc-700" />;
}

/** Prevent top toolbar buttons from stealing focus from the outline editor on touch (keeps keyboard open). */
const stopEditorFocusSteal = {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
  },
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  },
};

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
  memoType,
  workflowStatus,
  onWorkflowChange,
  gamedevStage,
  onGamedevStageChange,
  activeMemoId,
  readOnly = false,
}: ToolbarProps) {
  const { t } = useTranslation();
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isMobileRichTextToolbarOpen = useMobileUiStore((s) => s.isMobileRichTextToolbarOpen);
  const toggleMobileRichTextToolbar = useMobileUiStore((s) => s.toggleMobileRichTextToolbar);
  const openShareModal = useShareModalStore((s) => s.openShareModal);
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const [fontSize, setFontSize] = useState(14);
  const [color, setColor] = useState("#a78bfa");
  const [hexInput, setHexInput] = useState("a78bfa");
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
      "h-6 min-w-6 border px-1 text-xs disabled:opacity-40",
      active
        ? "border-zinc-500 bg-zinc-700 text-white ring-1 ring-inset ring-zinc-500"
        : "border-zinc-700 text-zinc-200 hover:enabled:border-zinc-500 hover:enabled:text-zinc-50",
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

  const pickColor = (nextColor: string) => {
    setColor(nextColor);
    setHexInput(nextColor.replace("#", ""));
    if (batchTargetIds) {
      applyForeColorWholeBodies(batchTargetIds, nextColor);
      commitBatchBodies(batchTargetIds);
      requestAnimationFrame(refreshFormatUi);
      return;
    }
    const activeEditor = getActiveEditor();
    if (!canEdit || !activeEditor) return;
    activeEditor.focus();
    applyFontColor(nextColor);
    onSyncActiveEditor();
    requestAnimationFrame(refreshFormatUi);
  };

  const handleHexInput = (val: string) => {
    if (!/^[0-9a-fA-F]{6}$/.test(val)) return;
    const hex = `#${val}`;
    setColor(hex);
    if (batchTargetIds) {
      applyForeColorWholeBodies(batchTargetIds, hex);
      commitBatchBodies(batchTargetIds);
      requestAnimationFrame(refreshFormatUi);
      return;
    }
    const activeEditor = getActiveEditor();
    if (!canEdit || !activeEditor) return;
    activeEditor.focus();
    applyFontColor(hex);
    onSyncActiveEditor();
    requestAnimationFrame(refreshFormatUi);
  };

  const formatMain = (
    <>
      <button
        type="button"
        disabled={!canEdit}
        {...stopEditorFocusSteal}
        onClick={() => runCommand("bold")}
        className={formatBtnClass(formatUi.bold)}
      >
        B
      </button>
      <button
        type="button"
        disabled={!canEdit}
        {...stopEditorFocusSteal}
        onClick={() => runCommand("italic")}
        className={formatBtnClass(formatUi.italic)}
      >
        I
      </button>
      <button
        type="button"
        disabled={!canEdit}
        {...stopEditorFocusSteal}
        onClick={() => runCommand("underline")}
        className={formatBtnClass(formatUi.underline)}
      >
        U
      </button>
      <button
        type="button"
        disabled={!canEdit}
        {...stopEditorFocusSteal}
        onClick={() => runCommand("strikeThrough")}
        className={formatBtnClass(formatUi.strikeThrough)}
      >
        S
      </button>

      <Separator />

      <button
        type="button"
        disabled={!canEdit}
        {...stopEditorFocusSteal}
        onClick={() => applyFontSize(fontSize - 1)}
        className="h-6 min-w-6 border border-zinc-700 px-1 text-xs text-zinc-200 disabled:opacity-40"
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
        className="h-6 w-12 border border-zinc-700 bg-zinc-800 text-center text-xs text-zinc-200 outline-none"
      />
      <button
        type="button"
        disabled={!canEdit}
        {...stopEditorFocusSteal}
        onClick={() => applyFontSize(fontSize + 1)}
        className="h-6 min-w-6 border border-zinc-700 px-1 text-xs text-zinc-200 disabled:opacity-40"
      >
        +
      </button>

      <Separator />

      <div
        className="relative h-6 w-6 overflow-hidden rounded border border-zinc-600"
        style={{ background: color }}
        title={t("toolbar.openColorPicker")}
      >
        <input
          ref={colorPickerRef}
          type="color"
          value={color}
          disabled={!canEdit}
          onChange={(event) => {
            const next = event.target.value;
            setColor(next);
            setHexInput(next.replace("#", ""));
            runCommand("foreColor", next);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      <div className="flex h-6 items-center gap-1 border border-zinc-700 bg-zinc-800 px-1.5">
        <span className="text-xs text-zinc-500">#</span>
        <input
          type="text"
          maxLength={6}
          value={hexInput}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(event) => {
            const val = event.target.value.replace(/[^0-9a-fA-F]/g, "");
            setHexInput(val);
            handleHexInput(val);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleHexInput(hexInput);
            }
          }}
          className="w-14 bg-transparent font-mono text-xs text-zinc-300 outline-none"
        />
      </div>

      {PRESET_COLORS.map((swatch) => (
        <button
          key={swatch}
          type="button"
          disabled={!canEdit}
          {...stopEditorFocusSteal}
          onClick={() => {
            if (color === swatch) {
              colorPickerRef.current?.click();
            } else {
              pickColor(swatch);
            }
          }}
          className={`h-3.5 w-3.5 rounded-full border transition-all hover:scale-110 disabled:opacity-40 ${color === swatch ? "border-white/60 scale-110" : "border-white/10"}`}
          style={{ background: swatch }}
        />
      ))}
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
            type="button"
            onClick={toggleMobileRichTextToolbar}
            aria-pressed={isMobileRichTextToolbarOpen}
            title={t("mobile.formatToolbarToggleHint")}
            aria-label={t("mobile.formatToolbarToggle")}
            {...stopEditorFocusSteal}
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
          type="button"
          title={t("toolbar.undo")}
          disabled={readOnly || !canUndo}
          {...stopEditorFocusSteal}
          onClick={onUndo}
          className="flex h-6 w-6 items-center justify-center border border-zinc-700 text-xs text-zinc-200 disabled:opacity-30 hover:enabled:border-zinc-500 hover:enabled:text-zinc-50"
        >
          ↩
        </button>
        <button
          type="button"
          title={t("toolbar.redo")}
          disabled={readOnly || !canRedo}
          {...stopEditorFocusSteal}
          onClick={onRedo}
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
            type="button"
            title={t("toolbar.share")}
            aria-label={t("toolbar.share")}
            disabled={readOnly}
            {...stopEditorFocusSteal}
            onClick={() => openShareModal(activeMemoId)}
            className="flex h-6 items-center gap-1 border border-zinc-700/90 bg-zinc-900/30 px-2 text-[10px] tracking-wide text-zinc-400 transition-colors hover:enabled:border-cyan-500/40 hover:enabled:bg-zinc-900/55 hover:enabled:text-cyan-200/90 disabled:opacity-40"
          >
            <Share2 size={12} strokeWidth={1.75} className="shrink-0 opacity-85" />
            <span className="max-[680px]:hidden">Share</span>
          </button>
          <ToolbarUnifiedMemoStatusControl
            memoType={memoType}
            workflowStatus={workflowStatus}
            onWorkflowChange={onWorkflowChange}
            gamedevStage={gamedevStage}
            onGamedevStageChange={onGamedevStageChange}
            disabled={readOnly}
          />
        </div>
      </div>

      {!isMdUp && isMobileRichTextToolbarOpen && (
        <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto border-t border-zinc-800/50 px-2 py-1.5 sm:px-3">
          {formatMain}
        </div>
      )}
    </div>
  );
}
