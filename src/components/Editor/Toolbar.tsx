"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToolbarUnifiedMemoStatusControl } from "@/components/MemoWorkflowMenu";
import { useShareModalStore } from "@/stores/shareModalStore";
import { Share2 } from "lucide-react";
import { useTextFormatting, type FormatCommand } from "@/hooks/useTextFormatting";
import {
  applyFontSizeWholeBodies,
  applyForeColorWholeBodies,
  applyFormatWholeBodies,
  collectBodyHtmlPatches,
} from "@/lib/editorBatchFormat";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";
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
};

const PRESET_COLORS = ["#a78bfa", "#60dfcd", "#f87171", "#fbbf24", "#e0e0e6"];

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
  memoType,
  workflowStatus,
  onWorkflowChange,
  gamedevStage,
  onGamedevStageChange,
  activeMemoId,
}: ToolbarProps) {
  const { t } = useTranslation();
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
    () => Boolean(batchTargetIds) || isEditorActive,
    [batchTargetIds, isEditorActive],
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

  return (
    <div
      data-geo-editor-toolbar
      className="sticky top-0 z-50 flex min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-zinc-800/60 bg-zinc-950/95 px-2 py-1.5 backdrop-blur-sm sm:px-3"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Undo / Redo */}
      <button
        type="button"
        title={t("toolbar.undo")}
        disabled={!canUndo}
        onClick={onUndo}
        className="flex h-6 w-6 items-center justify-center border border-zinc-700 text-xs text-zinc-200 disabled:opacity-30 hover:enabled:border-zinc-500 hover:enabled:text-zinc-50"
      >
        ↩
      </button>
      <button
        type="button"
        title={t("toolbar.redo")}
        disabled={!canRedo}
        onClick={onRedo}
        className="flex h-6 w-6 items-center justify-center border border-zinc-700 text-xs text-zinc-200 disabled:opacity-30 hover:enabled:border-zinc-500 hover:enabled:text-zinc-50"
      >
        ↪
      </button>

      <Separator />

      <button
        type="button"
        disabled={!canEdit}
        onClick={() => runCommand("bold")}
        className={formatBtnClass(formatUi.bold)}
      >
        B
      </button>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => runCommand("italic")}
        className={formatBtnClass(formatUi.italic)}
      >
        I
      </button>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => runCommand("underline")}
        className={formatBtnClass(formatUi.underline)}
      >
        U
      </button>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => runCommand("strikeThrough")}
        className={formatBtnClass(formatUi.strikeThrough)}
      >
        S
      </button>

      <Separator />

      <button
        type="button"
        disabled={!canEdit}
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
          onClick={() => {
            if (color === swatch) {
              // Same active color → open OS color picker for fine-tuning
              colorPickerRef.current?.click();
            } else {
              pickColor(swatch);
            }
          }}
          className={`h-3.5 w-3.5 rounded-full border transition-all hover:scale-110 disabled:opacity-40 ${color === swatch ? "border-white/60 scale-110" : "border-white/10"}`}
          style={{ background: swatch }}
        />
      ))}

      <Separator />

      <div
        className="ml-auto flex shrink-0 items-center gap-1.5"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title={t("toolbar.share")}
          aria-label={t("toolbar.share")}
          onClick={() => openShareModal(activeMemoId)}
          className="flex h-6 items-center gap-1 border border-zinc-700/90 bg-zinc-900/30 px-2 text-[10px] tracking-wide text-zinc-400 transition-colors hover:border-cyan-500/40 hover:bg-zinc-900/55 hover:text-cyan-200/90"
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
        />
      </div>
    </div>
  );
}
