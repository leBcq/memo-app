"use client";

import { cn } from "@/lib/utils";
import { MobileOutlineNodeToolsPanel } from "@/components/MobileOutlineNodeToolsPanel";
import type { HeadingLevel, NoteNode } from "@/types/note";
import type { MessageId } from "@/i18n/messages";
import { useTranslation } from "@/i18n/useTranslation";

export type MobileOutlineActionsSheetProps = {
  open: boolean;
  onClose: () => void;
  readOnly: boolean;
  isMobileSelectionMode: boolean;
  selectedCount: number;
  canPasteAnchor: boolean;
  hasFocusTarget: boolean;
  targetNode: NoteNode | null;
  textBatchTargetIds: string[];
  onPatchNodeContents: (patches: Record<string, string>) => void;
  onToggleSelectionMode: () => void;
  onCopy: () => void | Promise<void>;
  onCut: () => void | Promise<void>;
  onPaste: () => void | Promise<void>;
  onFocusTargetNode: () => void;
  onDeleteSelection: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onToggleCollapsed: () => void;
  onToggleCheckbox: () => void;
  onToggleCompleted: () => void;
  onSetHeading: (level: HeadingLevel) => void;
  onSetBgColor: (color: string | null) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onToggleNote: () => void;
};

function SheetRow({
  labelId,
  disabled,
  destructive,
  onActivate,
}: {
  labelId: MessageId;
  disabled?: boolean;
  destructive?: boolean;
  onActivate: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        void onActivate();
      }}
      className={cn(
        "flex w-full touch-manipulation items-center justify-between border-b border-zinc-800/70 px-4 py-3.5 text-left font-mono text-[13px] tracking-wide transition-colors",
        destructive ? "text-red-400/95 hover:bg-red-950/25" : "text-zinc-200 hover:bg-zinc-900/90",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      <span>{t(labelId)}</span>
    </button>
  );
}

/** Bottom sheet launched from the mobile outline FAB (overflow menu). */
export function MobileOutlineActionsSheet({
  open,
  onClose,
  readOnly,
  isMobileSelectionMode,
  selectedCount,
  canPasteAnchor,
  hasFocusTarget,
  targetNode,
  textBatchTargetIds,
  onPatchNodeContents,
  onToggleSelectionMode,
  onCopy,
  onCut,
  onPaste,
  onFocusTargetNode,
  onDeleteSelection,
  onIndent,
  onOutdent,
  onToggleCollapsed,
  onToggleCheckbox,
  onToggleCompleted,
  onSetHeading,
  onSetBgColor,
  onAddChild,
  onAddSibling,
  onToggleNote,
}: MobileOutlineActionsSheetProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const selectionLabel: MessageId = isMobileSelectionMode
    ? "mobile.actionsMenu.selectionOff"
    : "mobile.actionsMenu.selectionOn";

  const copyDisabled = readOnly || selectedCount === 0;
  const cutDisabled = readOnly || selectedCount === 0;
  const pasteDisabled = readOnly || !canPasteAnchor;
  const focusDisabled = readOnly || !hasFocusTarget;
  const deleteDisabled = readOnly || selectedCount === 0;

  return (
    <div
      className="fixed inset-0 z-[9998] md:hidden"
      data-mobile-outline-actions-sheet="true"
      aria-modal
      role="dialog"
      aria-label={t("mobile.actionsMenu.dialogAria")}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("mobile.actionsMenu.closeBackdrop")}
        className="absolute inset-0 bg-black/30"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 flex max-h-[min(58vh,480px)] flex-col overflow-hidden rounded-t-xl border border-zinc-700/75 bg-zinc-950/96 pb-[max(env(safe-area-inset-bottom),10px)] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm",
        )}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-zinc-600/90" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <SheetRow labelId={selectionLabel} onActivate={onToggleSelectionMode} />
          <SheetRow labelId="mobile.actionsMenu.copy" disabled={copyDisabled} onActivate={onCopy} />
          <SheetRow labelId="mobile.actionsMenu.cut" disabled={cutDisabled} onActivate={onCut} />
          <SheetRow labelId="mobile.actionsMenu.paste" disabled={pasteDisabled} onActivate={onPaste} />
          <SheetRow
            labelId="mobile.actionsMenu.focusNode"
            disabled={focusDisabled}
            onActivate={onFocusTargetNode}
          />
          <SheetRow
            labelId="mobile.actionsMenu.delete"
            destructive
            disabled={deleteDisabled}
            onActivate={onDeleteSelection}
          />

          <MobileOutlineNodeToolsPanel
            readOnly={readOnly}
            targetNode={targetNode}
            textBatchTargetIds={textBatchTargetIds}
            onPatchNodeContents={onPatchNodeContents}
            onIndent={onIndent}
            onOutdent={onOutdent}
            onToggleCollapsed={onToggleCollapsed}
            onToggleCheckbox={onToggleCheckbox}
            onToggleCompleted={onToggleCompleted}
            onSetHeading={onSetHeading}
            onSetBgColor={onSetBgColor}
            onFocusNode={onFocusTargetNode}
            onAddChild={onAddChild}
            onAddSibling={onAddSibling}
            onToggleNote={onToggleNote}
          />
        </div>
        <SheetRow labelId="mobile.actionsMenu.close" onActivate={onClose} />
      </div>
    </div>
  );
}
