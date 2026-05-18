"use client";

import { FileStack } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileItemColor } from "@/types/fileSystem";
import {
  isModeStripTintFullyTransparent,
  getSolidThemeColor,
  modeStripBadgeCellStyle,
  modeStripBadgeDiamondStyle,
  modeStripBadgeLabelStyle,
} from "@/lib/memoThemeColor";
import { useTranslation } from "@/i18n/useTranslation";

type Props = {
  onAddSpecCard: () => void;
  themeColor: string;
  themeChromeAlphaMult?: number;
  /** Raw sidebar `FileItem.color` — forces borderless badge when alpha is 0 in storage. */
  rowTintSourceColor?: FileItemColor | null;
  readOnly?: boolean;
};

/** Thin toolbar row for gamedev memos (mirrors music strip height / chrome). */
export function GamedevToolbarStrip({
  onAddSpecCard,
  themeColor,
  themeChromeAlphaMult = 1,
  rowTintSourceColor,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const chrome = themeChromeAlphaMult;
  const noTintChrome = isModeStripTintFullyTransparent(chrome, rowTintSourceColor);
  const solidAccent = getSolidThemeColor(themeColor, "#00f0ff");

  return (
    <div
      className={cn(
        "relative z-[100] flex h-9 shrink-0 items-stretch",
        "bg-zinc-950/95 font-mono text-[11px]",
        "shadow-[inset_0_1px_0_rgba(6,182,212,0.06)]",
        readOnly && "pointer-events-none select-none opacity-[0.72]",
      )}
    >
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
          {t("gamedev.stripLabel")}
        </span>
      </div>

      <div
        className={cn(
          "relative z-20 flex flex-1 items-center px-2",
          !noTintChrome && "border-l border-zinc-800/80",
        )}
      >
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddSpecCard();
          }}
          className={cn(
            "flex h-full items-center gap-2 px-2.5 transition-colors",
            "text-[8px] leading-tight tracking-[0.14em] text-zinc-500",
            "hover:bg-zinc-900/80",
          )}
          title={t("gamedev.addSpecTitle")}
        >
          <FileStack
            size={13}
            className="shrink-0"
            strokeWidth={2}
            style={{ color: solidAccent, opacity: 1 }}
          />
          <span className="font-medium" style={{ color: solidAccent }}>
            {t("gamedev.addSpecCard")}
          </span>
          <span className="hidden text-[7px] tracking-wide text-zinc-600 sm:inline">
            {t("gamedev.addSpecSub")}
          </span>
        </button>
      </div>
    </div>
  );
}
