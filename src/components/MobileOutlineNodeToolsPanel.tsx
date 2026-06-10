"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { MENU_COLOR_PRESETS } from "@/lib/menuColorUtils";
import { menuSwatchClass } from "@/components/MenuColorPicker/primitives";
import type { HeadingLevel, NoteNode } from "@/types/note";
import type { MessageId } from "@/i18n/messages";
import { useTranslation } from "@/i18n/useTranslation";
import {
  applyFontSizeWholeBodies,
  applyForeColorWholeBodies,
  applyFormatWholeBodies,
  collectBodyHtmlPatches,
} from "@/lib/editorBatchFormat";
import type { FormatCommand } from "@/hooks/useTextFormatting";

export type MobileOutlineNodeToolsPanelProps = {
  readOnly: boolean;
  targetNode: NoteNode | null;
  textBatchTargetIds: string[];
  onPatchNodeContents: (patches: Record<string, string>) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onToggleCollapsed: () => void;
  onToggleCheckbox: () => void;
  onToggleCompleted: () => void;
  onSetHeading: (level: HeadingLevel) => void;
  onSetBgColor: (color: string | null) => void;
  onFocusNode: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onToggleNote: () => void;
};

function SheetTapButton({
  labelId,
  disabled,
  active,
  onActivate,
  children,
}: {
  labelId?: MessageId;
  disabled?: boolean;
  active?: boolean;
  onActivate: () => void;
  children?: React.ReactNode;
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
        onActivate();
      }}
      className={cn(
        "touch-manipulation rounded-md border px-2.5 py-2 font-mono text-[11px] tracking-wide transition-colors",
        active
          ? "border-cyan-500/50 bg-cyan-950/35 text-cyan-100"
          : "border-zinc-700/80 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800/90",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children ?? (labelId ? t(labelId) : null)}
    </button>
  );
}

function Section({
  titleId,
  children,
}: {
  titleId: MessageId;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="border-b border-zinc-800/60 px-3 py-2.5">
      <p className="mb-2 font-mono text-[9px] font-semibold tracking-[2px] text-zinc-100">{t(titleId)}</p>
      {children}
    </div>
  );
}

/** Compact node tools for the mobile outline FAB sheet (mirrors PC NodeContextMenu sections). */
export function MobileOutlineNodeToolsPanel({
  readOnly,
  targetNode,
  textBatchTargetIds,
  onPatchNodeContents,
  onIndent,
  onOutdent,
  onToggleCollapsed,
  onToggleCheckbox,
  onToggleCompleted,
  onSetHeading,
  onSetBgColor,
  onFocusNode,
  onAddChild,
  onAddSibling,
  onToggleNote,
}: MobileOutlineNodeToolsPanelProps) {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState(14);

  const disabled = readOnly || !targetNode;

  const syncBodies = () => {
    onPatchNodeContents(collectBodyHtmlPatches(textBatchTargetIds));
  };

  const runFormat = (cmd: FormatCommand) => {
    if (disabled) return;
    applyFormatWholeBodies(textBatchTargetIds, cmd);
    syncBodies();
  };

  const applyFg = (hex: string) => {
    if (disabled) return;
    applyForeColorWholeBodies(textBatchTargetIds, hex);
    syncBodies();
  };

  const applySize = (size: number) => {
    if (disabled) return;
    setFontSize(size);
    applyFontSizeWholeBodies(textBatchTargetIds, size);
    syncBodies();
  };

  const headingLevels = useMemo(
    () => (["h1", "h2", "h3", null] as const),
    [],
  );

  if (!targetNode) {
    return (
      <Section titleId="mobile.actionsMenu.toolsSection">
        <p className="font-mono text-[11px] text-zinc-500">{t("mobile.actionsMenu.noTargetNode")}</p>
      </Section>
    );
  }

  return (
    <>
      <Section titleId="mobile.actionsMenu.structureSection">
        <div className="flex flex-wrap gap-1.5">
          <SheetTapButton labelId="mobile.actionsMenu.focusNode" disabled={disabled} onActivate={onFocusNode} />
          <SheetTapButton labelId="mobile.actionsMenu.indent" disabled={disabled} onActivate={onIndent} />
          <SheetTapButton labelId="mobile.actionsMenu.outdent" disabled={disabled} onActivate={onOutdent} />
          <SheetTapButton
            disabled={disabled}
            active={targetNode.collapsed}
            onActivate={onToggleCollapsed}
          >
            {targetNode.collapsed ? t("mobile.actionsMenu.expand") : t("mobile.actionsMenu.collapse")}
          </SheetTapButton>
        </div>
      </Section>

      <Section titleId="mobile.actionsMenu.taskSection">
        <div className="flex flex-wrap gap-1.5">
          <SheetTapButton
            disabled={disabled}
            active={targetNode.hasCheckbox}
            onActivate={onToggleCheckbox}
          >
            {t("mobile.actionsMenu.checkbox")}
          </SheetTapButton>
          <SheetTapButton
            disabled={disabled || !targetNode.hasCheckbox}
            active={targetNode.completed}
            onActivate={onToggleCompleted}
          >
            {targetNode.completed ? t("mobile.actionsMenu.uncomplete") : t("mobile.actionsMenu.complete")}
          </SheetTapButton>
        </div>
      </Section>

      <Section titleId="mobile.actionsMenu.nodeSection">
        <div className="flex flex-wrap gap-1.5">
          <SheetTapButton labelId="mobile.actionsMenu.addChild" disabled={disabled} onActivate={onAddChild} />
          <SheetTapButton labelId="mobile.actionsMenu.addSibling" disabled={disabled} onActivate={onAddSibling} />
          <SheetTapButton
            disabled={disabled}
            active={targetNode.note !== null}
            onActivate={onToggleNote}
          >
            {t("mobile.actionsMenu.noteToggle")}
          </SheetTapButton>
        </div>
      </Section>

      <Section titleId="mobile.actionsMenu.textSection">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {(["bold", "italic", "underline", "strikeThrough"] as const).map((cmd) => (
            <button
              key={cmd}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                runFormat(cmd);
              }}
              className="flex h-8 min-w-[2rem] touch-manipulation items-center justify-center rounded border border-zinc-600/80 bg-zinc-900/70 px-2 text-[12px] font-medium text-zinc-50 disabled:opacity-35"
            >
              {cmd === "bold" ? <b>B</b> : cmd === "italic" ? <i>I</i> : cmd === "underline" ? <u>U</u> : <s>S</s>}
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px bg-zinc-700" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => applySize(Math.max(8, fontSize - 1))}
            className="flex h-8 w-8 touch-manipulation items-center justify-center rounded border border-zinc-600/80 text-zinc-100 disabled:opacity-35"
          >
            −
          </button>
          <span className="min-w-[1.75rem] text-center font-mono text-[11px] font-medium text-zinc-50">{fontSize}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => applySize(Math.min(72, fontSize + 1))}
            className="flex h-8 w-8 touch-manipulation items-center justify-center rounded border border-zinc-600/80 text-zinc-100 disabled:opacity-35"
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {MENU_COLOR_PRESETS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              disabled={disabled}
              title={swatch}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                applyFg(swatch);
              }}
              className={cn(menuSwatchClass(false), "h-7 w-7 touch-manipulation disabled:opacity-35")}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </Section>

      <Section titleId="mobile.actionsMenu.styleSection">
        <div className="mb-2 flex flex-wrap gap-1">
          {headingLevels.map((level) => (
            <SheetTapButton
              key={level ?? "body"}
              disabled={disabled}
              active={targetNode.headingLevel === level}
              onActivate={() => onSetHeading(level)}
            >
              {level ?? "T"}
            </SheetTapButton>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {MENU_COLOR_PRESETS.map((swatch) => (
            <button
              key={`bg-${swatch}`}
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetBgColor(swatch);
              }}
              className={cn(
                menuSwatchClass(targetNode.bgColor === swatch),
                "h-7 w-7 touch-manipulation ring-1 ring-inset ring-white/10 disabled:opacity-35",
              )}
              style={{ background: swatch }}
            />
          ))}
          <SheetTapButton disabled={disabled} onActivate={() => onSetBgColor(null)}>
            {t("mobile.actionsMenu.clearRowColor")}
          </SheetTapButton>
        </div>
      </Section>
    </>
  );
}
