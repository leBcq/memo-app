"use client";

import {
  IndentIncrease,
  IndentDecrease,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Crosshair,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageId } from "@/i18n/messages";
import { useTranslation } from "@/i18n/useTranslation";
import { useVisualViewportBottomInsetPx } from "@/hooks/useVisualViewportBottomInsetPx";
import type { ReactNode } from "react";

type Props = {
  visible: boolean;
  /** Outline node ids that support indent / checklist / collapse. */
  hasChildren: boolean;
  collapsed: boolean;
  hasCheckbox: boolean;
  onIndent: () => void;
  onOutdent: () => void;
  onToggleCollapsed: () => void;
  onToggleCheckboxMode: () => void;
  onFocusNode: () => void;
  onDeleteNode: () => void;
};

const TB_H = "var(--freavia-mobile-editor-tb-height,52px)";

/** Quick actions above the keyboard (mobile md breakpoint only). Dynalist-inspired. */
export function MobileNodeEditorToolbar({
  visible,
  hasChildren,
  collapsed,
  hasCheckbox,
  onIndent,
  onOutdent,
  onToggleCollapsed,
  onToggleCheckboxMode,
  onFocusNode,
  onDeleteNode,
}: Props) {
  const { t } = useTranslation();
  const keyboardInsetPx = useVisualViewportBottomInsetPx();

  if (!visible) return null;

  const tip = (id: MessageId) => t(id);

  return (
    <div
      role="toolbar"
      data-mobile-editor-quickbar="true"
      aria-label={tip("mobile.editorBar.toolbarAria")}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex w-full md:hidden",
        "items-stretch gap-px border-t border-zinc-800/70 bg-zinc-950/[0.96] backdrop-blur-md shadow-[0_-12px_32px_rgba(0,0,0,0.45)]",
      )}
      style={{
        bottom: keyboardInsetPx,
        minHeight: TB_H,
        height: TB_H,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 6px)",
        paddingTop: "4px",
        paddingLeft: "max(env(safe-area-inset-left, 0px), 8px)",
        paddingRight: "max(env(safe-area-inset-right, 0px), 8px)",
      }}
    >
      <ToolbarIconButton ariaLabel={tip("mobile.editorBar.indent")} onPointerDown={(e) => e.preventDefault()} onClick={onIndent}>
        <IndentIncrease size={20} strokeWidth={2} className="shrink-0" />
      </ToolbarIconButton>
      <ToolbarIconButton ariaLabel={tip("mobile.editorBar.outdent")} onPointerDown={(e) => e.preventDefault()} onClick={onOutdent}>
        <IndentDecrease size={20} strokeWidth={2} className="shrink-0" />
      </ToolbarIconButton>
      <ToolbarIconButton
        ariaLabel={
          collapsed
            ? tip("mobile.editorBar.expandChildren")
            : tip("mobile.editorBar.collapseChildren")
        }
        disabled={!hasChildren}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onToggleCollapsed}
      >
        {collapsed ? (
          <ChevronRight size={20} strokeWidth={2} className="shrink-0" />
        ) : (
          <ChevronDown size={20} strokeWidth={2} className="shrink-0" />
        )}
      </ToolbarIconButton>
      <ToolbarIconButton
        ariaLabel={tip("mobile.editorBar.toggleCheckbox")}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onToggleCheckboxMode}
        className={hasCheckbox ? "text-cyan-300" : undefined}
      >
        {hasCheckbox ? (
          <CheckSquare size={20} strokeWidth={2} className="shrink-0" />
        ) : (
          <Square size={20} strokeWidth={2} className="shrink-0" />
        )}
      </ToolbarIconButton>
      <ToolbarIconButton ariaLabel={tip("mobile.editorBar.focusNode")} onPointerDown={(e) => e.preventDefault()} onClick={onFocusNode}>
        <Crosshair size={20} strokeWidth={2} className="shrink-0" />
      </ToolbarIconButton>
      <ToolbarIconButton
        ariaLabel={tip("mobile.editorBar.deleteNode")}
        onPointerDown={(e) => e.preventDefault()}
        onClick={onDeleteNode}
        className="text-red-400/95 hover:bg-red-950/35 hover:text-red-300"
      >
        <Trash2 size={19} strokeWidth={2} className="shrink-0" />
      </ToolbarIconButton>
    </div>
  );
}

function ToolbarIconButton({
  children,
  onClick,
  onPointerDown,
  disabled,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-md px-2 text-zinc-300 outline-none transition-colors touch-manipulation",
        "disabled:pointer-events-none disabled:opacity-[0.35]",
        !disabled && "active:bg-zinc-800 hover:bg-zinc-900 hover:text-white",
        className,
      )}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
    >
      {children}
    </button>
  );
}
