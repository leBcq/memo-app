"use client";

import { cn } from "@/lib/utils";
import { attachChromeProofTap } from "@/lib/chromeProofPointerHandlers";
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
  onToggleSelectionMode: () => void;
  onCopy: () => void | Promise<void>;
  onCut: () => void | Promise<void>;
  onPaste: () => void | Promise<void>;
  onFocusTargetNode: () => void;
  onDeleteSelection: () => void;
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
  const tap = attachChromeProofTap({
    onActivate: () => {
      void onActivate();
    },
    disabled,
  });
  return (
    <button
      {...tap}
      disabled={disabled}
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
  onToggleSelectionMode,
  onCopy,
  onCut,
  onPaste,
  onFocusTargetNode,
  onDeleteSelection,
}: MobileOutlineActionsSheetProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const backdropTap = attachChromeProofTap({
    onActivate: onClose,
  });

  const selectionLabel: MessageId = isMobileSelectionMode
    ? "mobile.actionsMenu.selectionOff"
    : "mobile.actionsMenu.selectionOn";

  const copyDisabled = readOnly || selectedCount === 0;
  const cutDisabled = readOnly || selectedCount === 0;
  const pasteDisabled = readOnly || !canPasteAnchor;
  const focusDisabled = readOnly || !hasFocusTarget;
  const deleteDisabled = readOnly || selectedCount === 0;

  return (
    <div className="fixed inset-0 z-[92] md:hidden" aria-modal role="dialog" aria-label={t("mobile.actionsMenu.dialogAria")}>
      <button
        {...backdropTap}
        aria-label={t("mobile.actionsMenu.closeBackdrop")}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 max-h-[min(72vh,520px)] overflow-y-auto rounded-t-xl border border-zinc-700/80 bg-zinc-950 pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-16px_48px_rgba(0,0,0,0.55)]",
        )}
      >
        <div className="flex flex-col px-1 pt-2">
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-zinc-700/90" aria-hidden />
          <SheetRow
            labelId={selectionLabel}
            onActivate={() => {
              onToggleSelectionMode();
              onClose();
            }}
          />
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
        </div>
      </div>
    </div>
  );
}
