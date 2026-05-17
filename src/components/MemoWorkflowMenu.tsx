"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GAMEDEV_STAGE_COLORS, type GamedevStage } from "@/types/gamedev";
import type { MemoType } from "@/types/memoKind";
import {
  MEMO_WORKFLOW_COLORS,
  MEMO_WORKFLOW_LABEL,
  type MemoWorkflowStatus,
} from "@/types/memoWorkflow";
import {
  GAMEDEV_STAGE_OPTIONS,
  getMemoStatusMenuSectionKeys,
  WORKFLOW_STATUS_OPTIONS,
} from "@/config/memoStatusMenu";
import { useTranslation } from "@/i18n/useTranslation";

export type UnifiedMemoStatusMenuProps = {
  memoType: MemoType;
  workflowStatus: MemoWorkflowStatus;
  onWorkflowChange: (s: MemoWorkflowStatus) => void;
  gamedevStage?: GamedevStage;
  onGamedevStageChange?: (s: GamedevStage) => void;
  onPickComplete?: () => void;
};

/** Top-right menu: memo workflow for all kinds; + game pipeline only when memoType is gamedev. */
export function UnifiedMemoStatusMenuContent({
  memoType,
  workflowStatus,
  onWorkflowChange,
  gamedevStage,
  onGamedevStageChange,
  onPickComplete,
}: UnifiedMemoStatusMenuProps) {
  const { t } = useTranslation();
  const sections = getMemoStatusMenuSectionKeys(memoType);

  return (
    <>
      {sections.includes("workflow") && (
        <>
          <p className="px-3 pb-1 text-[8px] tracking-[2px] text-zinc-600">{t("workflow.memoStatusSection")}</p>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {WORKFLOW_STATUS_OPTIONS.map((s) => {
              const c = MEMO_WORKFLOW_COLORS[s];
              const on = s === workflowStatus;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onWorkflowChange(s);
                    onPickComplete?.();
                  }}
                  className={cn(
                    "border px-2 py-1 text-[9px] tracking-wider transition-colors",
                    on ? "bg-zinc-900/80" : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300",
                  )}
                  style={
                    on
                      ? { borderColor: `${c}88`, color: c, boxShadow: `0 0 10px ${c}22` }
                      : { borderColor: "rgba(63,63,70,0.5)" }
                  }
                >
                  {MEMO_WORKFLOW_LABEL[s]}
                </button>
              );
            })}
          </div>
        </>
      )}

      {sections.includes("gamedev") && gamedevStage !== undefined && onGamedevStageChange && (
        <div className="mx-2 border-t border-zinc-800/80 pt-2">
          <p className="px-1 pb-1 text-[8px] tracking-[2px] text-zinc-600">{t("workflow.gamePipeline")}</p>
          <div className="max-h-[200px] overflow-y-auto">
            {GAMEDEV_STAGE_OPTIONS.map((s) => {
              const color = GAMEDEV_STAGE_COLORS[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    onGamedevStageChange(s);
                    onPickComplete?.();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 transition-colors hover:bg-zinc-900/70",
                    s === gamedevStage && "bg-zinc-900/55",
                  )}
                >
                  <div
                    className="h-1.5 w-1.5 shrink-0"
                    style={{
                      clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)",
                      background: color,
                      boxShadow: `0 0 6px ${color}88`,
                    }}
                  />
                  <span className="text-[10px] tracking-wider" style={{ color }}>
                    {s}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

const WORKFLOW_LABEL_SHORT: Record<MemoWorkflowStatus, string> = {
  DRAFT: "DRAFT",
  WIP: "WIP",
  DONE: "DONE",
};

/**
 * One status control for the top toolbar (DRAFT / WIP / DONE for every memo kind).
 */
export function ToolbarUnifiedMemoStatusControl(
  props: UnifiedMemoStatusMenuProps & { panelZClass?: string },
) {
  const { workflowStatus, panelZClass = "z-[200]" } = props;
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const wfColor = MEMO_WORKFLOW_COLORS[workflowStatus];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-6 max-w-[140px] items-center gap-1.5 border border-zinc-700 bg-zinc-900/30 px-2 text-[10px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
        title={t("workflow.memoStatusTitle")}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: wfColor, boxShadow: `0 0 8px ${wfColor}88` }}
        />
        <span className="truncate tracking-wide">{WORKFLOW_LABEL_SHORT[workflowStatus]}</span>
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 min-w-[200px] border border-zinc-700/80 bg-zinc-950/95 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
            panelZClass,
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <UnifiedMemoStatusMenuContent {...props} onPickComplete={close} />
        </div>
      )}
    </div>
  );
}
