"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MemoMusicMeta } from "@/types/memoKind";
import { clampBpm, keyQualityToScale, scaleToKeyQuality } from "@/types/memoKind";
import { NOTE_ROOTS } from "@/types/song";
import { cn } from "@/lib/utils";
import type { FileItemColor } from "@/types/fileSystem";
import { MusicReleaseProgressControl } from "@/components/TrackStatusBar/MusicReleaseProgressControl";
import {
  isModeStripTintFullyTransparent,
  modeStripBadgeCellStyle,
  modeStripBadgeDiamondStyle,
  modeStripBadgeLabelStyle,
} from "@/lib/memoThemeColor";
import { useTranslation } from "@/i18n/useTranslation";

type TrackStatusBarProps = {
  meta: MemoMusicMeta;
  onPatch: (patch: Partial<MemoMusicMeta>) => void;
  onInsertStructure?: () => void;
  onAddPlugin?: () => void;
  themeColor: string;
  /** Sidebar row-tint alpha multiplier (0 = hide themed borders/fills on strip). */
  themeChromeAlphaMult?: number;
  /** Raw sidebar `FileItem.color` borderless badge when alpha is 0 in storage. */
  rowTintSourceColor?: FileItemColor | null;
  /** Shared viewer: strip is display-only. */
  readOnly?: boolean;
};

export function TrackStatusBar({
  meta,
  onPatch,
  onInsertStructure,
  onAddPlugin,
  themeColor,
  themeChromeAlphaMult = 1,
  rowTintSourceColor,
  readOnly = false,
}: TrackStatusBarProps) {
  const { t } = useTranslation();
  const chrome = themeChromeAlphaMult;
  const noTintChrome = isModeStripTintFullyTransparent(chrome, rowTintSourceColor);
  const [bpmOpen, setBpmOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement>(null);
  const bpmDragRef = useRef<{ y: number; bpm: number } | null>(null);
  const keyQ = scaleToKeyQuality(meta.scale);

  const closeAllMenus = useCallback(() => {
    setBpmOpen(false);
    setKeyOpen(false);
    setReleaseOpen(false);
  }, []);

  const commitBpm = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, 3);
      const val = digits === "" ? NaN : parseInt(digits, 10);
      if (!Number.isNaN(val)) onPatch({ bpm: clampBpm(val) });
      setBpmOpen(false);
    },
    [onPatch],
  );

  const nudgeBpm = useCallback(
    (delta: number) => {
      onPatch({ bpm: clampBpm(meta.bpm + delta) });
    },
    [meta.bpm, onPatch],
  );

  const onBpmStripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      bpmDragRef.current = { y: e.clientY, bpm: meta.bpm };
      const onMove = (ev: MouseEvent) => {
        const d = bpmDragRef.current;
        if (!d) return;
        const dy = d.y - ev.clientY;
        const next = clampBpm(d.bpm + Math.round(dy * 0.45));
        onPatch({ bpm: next });
      };
      const onUp = () => {
        bpmDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [meta.bpm, onPatch],
  );

  useEffect(() => {
    if (bpmOpen) requestAnimationFrame(() => bpmInputRef.current?.select());
  }, [bpmOpen]);

  const anyMenuOpen = bpmOpen || keyOpen || releaseOpen;

  return (
    <div
      className={cn(
        "relative z-[100] flex h-9 shrink-0 flex-col",
        "bg-zinc-950/95 font-mono text-[11px]",
        "shadow-[inset_0_1px_0_rgba(6,182,212,0.06)]",
        readOnly && "pointer-events-none select-none opacity-[0.72]",
      )}
    >
      {anyMenuOpen && (
        <button
          type="button"
          aria-label={t("music.closeMenusAria")}
          className="fixed inset-0 z-0 cursor-default bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            closeAllMenus();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      )}

      <div className="relative z-10 flex min-h-9 min-w-0 flex-1 items-stretch border-b border-zinc-800/80">
        <div
          className="relative flex shrink-0 items-center gap-2 px-3"
          style={modeStripBadgeCellStyle(themeColor, chrome, noTintChrome)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className="h-[5px] w-[5px] shrink-0 rotate-45"
            aria-hidden
            style={modeStripBadgeDiamondStyle(themeColor, chrome, noTintChrome)}
          />
          <span
            className="shrink-0 text-[9px] tracking-[2.5px]"
            style={modeStripBadgeLabelStyle(themeColor, chrome, noTintChrome)}
          >
            {t("music.stripLabel")}
          </span>
        </div>

        <div
          className={cn(
            "relative z-20 flex min-w-[120px] items-center",
            !noTintChrome && "border-l border-zinc-800/80",
          )}
        >
          <button
            type="button"
            onMouseDown={onBpmStripMouseDown}
            onClick={(e) => {
              e.stopPropagation();
              setBpmOpen((v) => !v);
              setKeyOpen(false);
              setReleaseOpen(false);
            }}
            className={cn(
              "flex h-full cursor-ns-resize items-center gap-2 px-3 transition-colors",
              bpmOpen ? "bg-cyan-950/35 text-cyan-200" : "text-zinc-500 hover:text-zinc-200",
            )}
            title={t("music.bpmInputHint")}
          >
            <span className="text-[9px] tracking-[2px] text-zinc-600">{t("music.bpm")}</span>
            <span className="tabular-nums text-zinc-100 drop-shadow-[0_0_6px_rgba(250,250,250,0.08)]">
              {meta.bpm}
            </span>
          </button>

          <div className="flex h-full flex-col justify-center border-l border-zinc-800/60 py-0.5 pr-1 pl-0.5">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                nudgeBpm(1);
              }}
              className="flex h-[11px] w-5 shrink-0 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-cyan-950/40 hover:text-cyan-300"
              aria-label={t("music.bpmUpAria")}
            >
              <ChevronUp size={10} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                nudgeBpm(-1);
              }}
              className="flex h-[11px] w-5 shrink-0 items-center justify-center rounded-sm text-zinc-500 transition-colors hover:bg-cyan-950/40 hover:text-cyan-300"
              aria-label={t("music.bpmDownAria")}
            >
              <ChevronDown size={10} strokeWidth={2.5} />
            </button>
          </div>

          {bpmOpen && (
            <div
              className={cn(
                "absolute right-0 top-full z-[130] mt-px min-w-[148px] border border-cyan-500/20",
                "bg-zinc-950/95 p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
              )}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="mb-1.5 text-[8px] tracking-[2px] text-zinc-600">{t("music.bpm")}</p>
              <input
                key={meta.bpm}
                ref={bpmInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={meta.bpm}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitBpm(e.currentTarget.value);
                  if (e.key === "Escape") setBpmOpen(false);
                  if (e.ctrlKey || e.metaKey || e.altKey) return;
                  if (e.key.length === 1 && !/^\d$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
                onBlur={(e) => commitBpm(e.target.value)}
                className="w-full border border-zinc-700/80 bg-zinc-900/80 px-2 py-1.5 text-sm text-zinc-100 outline-none [appearance:textfield] focus:border-cyan-600/50 focus:ring-1 focus:ring-cyan-500/25 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <div className="mt-2 grid grid-cols-4 gap-1">
                {[-5, -1, +1, +5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => nudgeBpm(d)}
                    className="border border-zinc-800/90 bg-zinc-900/40 px-1 py-1 text-[9px] text-zinc-400 transition-colors hover:border-cyan-700/50 hover:text-cyan-300"
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {onInsertStructure && (
          <div className="relative z-20 flex items-center border-l border-zinc-800/80">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeAllMenus();
                onInsertStructure();
              }}
              className={cn(
                "h-full px-2.5 text-left transition-colors",
                "text-[8px] leading-tight tracking-[0.12em] text-zinc-500",
                "hover:bg-fuchsia-950/20 hover:text-fuchsia-200/90",
              )}
              title={t("music.insertTitle")}
            >
              <span className="block font-medium text-zinc-400">{t("music.insertStructure")}</span>
              <span className="block text-[7px] tracking-wide text-zinc-600">{t("music.insertStructureSub")}</span>
            </button>
          </div>
        )}

        {onAddPlugin && (
          <div className="relative z-20 flex items-center border-l border-zinc-800/80">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeAllMenus();
                onAddPlugin();
              }}
              className={cn(
                "h-full px-2.5 text-left transition-colors",
                "text-[8px] leading-tight tracking-[0.12em] text-zinc-500",
                "hover:bg-violet-950/25 hover:text-violet-200/90",
              )}
              title={t("music.addPluginTitle")}
            >
              <span className="block font-medium text-zinc-400">{t("music.addPlugin")}</span>
              <span className="block text-[7px] tracking-wide text-zinc-600">{t("music.addPluginSub")}</span>
            </button>
          </div>
        )}

        <div className="relative z-20 flex min-w-0 flex-1 items-stretch border-l border-zinc-800/80">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setKeyOpen((v) => !v);
              setBpmOpen(false);
              setReleaseOpen(false);
            }}
            className={cn(
              "flex h-full min-w-0 flex-1 items-center gap-2 px-3 transition-colors",
              keyOpen ? "bg-fuchsia-950/25 text-fuchsia-200" : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            <span className="text-[9px] tracking-[2px] text-zinc-600">{t("music.key")}</span>
            <span className="shrink-0 text-zinc-100">{meta.key}</span>
            <span
              className={cn(
                "shrink-0 rounded-sm border border-zinc-800/80 px-1 py-px text-[9px] tracking-wider",
                keyQ === "min" ? "border-violet-500/35 text-violet-300" : "border-zinc-700 text-zinc-400",
              )}
            >
              {keyQ === "min" ? "min" : "maj"}
            </span>
          </button>

          {keyOpen && (
            <div
              className={cn(
                "absolute right-0 top-full z-[130] mt-px w-[200px] border border-fuchsia-500/15",
                "bg-zinc-950/95 p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
              )}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[8px] tracking-[2px] text-zinc-600">{t("music.scale")}</span>
                <div className="flex gap-1">
                  {(["maj", "min"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPatch({ scale: keyQualityToScale(q) })}
                      className={cn(
                        "border px-2 py-0.5 text-[9px] tracking-wider transition-colors",
                        keyQ === q
                          ? q === "min"
                            ? "border-violet-500/60 bg-violet-950/30 text-violet-200"
                            : "border-cyan-500/50 bg-cyan-950/25 text-cyan-200"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300",
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-1 text-[8px] tracking-[2px] text-zinc-600">{t("music.root")}</p>
              <div className="flex flex-wrap gap-[4px]">
                {NOTE_ROOTS.map((root) => (
                  <button
                    key={root}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPatch({ key: root });
                      setKeyOpen(false);
                    }}
                    className={cn(
                      "min-w-[26px] border px-1 py-1 text-center text-[9px] transition-colors",
                      root === meta.key
                        ? "border-cyan-500/55 bg-cyan-950/35 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                        : "border-zinc-800/90 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300",
                    )}
                  >
                    {root}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <MusicReleaseProgressControl
          open={releaseOpen}
          onOpenChange={setReleaseOpen}
          status={meta.musicReleaseStatus}
          onChange={(s) => onPatch({ musicReleaseStatus: s })}
          onCloseSiblings={() => {
            setBpmOpen(false);
            setKeyOpen(false);
          }}
        />
      </div>
    </div>
  );
}
