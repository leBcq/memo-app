"use client";

import { useEffect, useRef } from "react";
import {
  type MusicReleaseStatus,
  MUSIC_RELEASE_PROGRESS_COLORS,
  MUSIC_RELEASE_PROGRESS_STAGES,
} from "@/types/memoKind";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/useTranslation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: MusicReleaseStatus;
  onChange: (s: MusicReleaseStatus) => void;
  onCloseSiblings: () => void;
};

/**
 * Cyber-minimal release pipeline control for the music toolbar (IDEA → LIVE).
 * Independent from memo workflow (DRAFT/WIP/DONE).
 */
export function MusicReleaseProgressControl({
  open,
  onOpenChange,
  status,
  onChange,
  onCloseSiblings,
}: Props) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const color = MUSIC_RELEASE_PROGRESS_COLORS[status];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative z-20 flex min-w-0 shrink-0 items-stretch border-l border-zinc-800/80 max-md:flex-1">
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCloseSiblings();
          onOpenChange(!open);
        }}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 md:min-h-0 md:h-full md:min-w-[148px]",
          open ? "bg-emerald-950/20 text-emerald-200/95" : "text-zinc-500 hover:text-zinc-200",
        )}
        title={t("music.releaseTitle")}
      >
        <span className="shrink-0 whitespace-nowrap text-[9px] tracking-[2px] text-zinc-600">{t("music.releaseBtn")}</span>
        <div
          className="h-[5px] w-[5px] shrink-0 rotate-45 shadow-[0_0_8px_currentColor]"
          style={{ background: color, color }}
          aria-hidden
        />
        <span
          className="min-w-0 flex-1 truncate text-[10px] font-medium tracking-wide tabular-nums text-zinc-100"
          style={{ textShadow: `0 0 12px ${color}22` }}
        >
          {status}
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-[130] mt-px w-[220px] border border-emerald-500/15",
            "bg-zinc-950/95 p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[8px] tracking-[2.5px] text-zinc-600">{t("music.releaseProgress")}</p>
          <div className="flex max-h-[240px] flex-col gap-px overflow-y-auto">
            {MUSIC_RELEASE_PROGRESS_STAGES.map((s) => {
              const c = MUSIC_RELEASE_PROGRESS_COLORS[s];
              const on = s === status;
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(s);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition-colors",
                    on ? "bg-zinc-900/70" : "hover:bg-zinc-900/45",
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0"
                    style={{
                      clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)",
                      background: c,
                      boxShadow: `0 0 8px ${c}88`,
                    }}
                  />
                  <span className="text-[10px] tracking-wider" style={{ color: c }}>
                    {s}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
