"use client";

import { matchesKeybind } from "@/config/keybinds";
import type { KeymapSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { hexToRgba, themeChromeRgba, isThemeChromeInvisible, getSolidThemeColor } from "@/lib/memoThemeColor";
import { SPEC_CARD_LABEL_CLASS, specCardOuterClass } from "@/components/Editor/specCardStyles";
import {
  GAME_SPEC_CATEGORIES,
  type NoteNode,
  type NoteGameData,
} from "@/types/note";
import { useTranslation } from "@/i18n/useTranslation";

type Keybinds = Pick<KeymapSettings, "ADD_SIBLING" | "INDENT" | "UNINDENT">;

type Props = {
  node: NoteNode & { gameData: NoteGameData };
  keybinds: Keybinds;
  accentColor: string;
  chromeAlphaMult?: number;
  onPatch: (patch: Partial<NoteGameData>, historyMode?: "immediate" | "none") => void;
  onAddSibling: () => void;
  onIndent: () => void;
  onUnindent: () => void;
  onDeleteEmpty: () => void;
  readOnly?: boolean;
};

export function GameSpecNodeCard({
  node,
  keybinds,
  accentColor,
  chromeAlphaMult = 1,
  onPatch,
  onAddSibling,
  onIndent,
  onUnindent,
  onDeleteEmpty,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const g = node.gameData;
  const chrome = chromeAlphaMult;
  const hideThemedChrome = isThemeChromeInvisible(chrome);
  const accentSolid = getSolidThemeColor(accentColor, "#00f0ff");

  const focusNameField = () => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-node-id="${node.id}"] [data-card-focus-target="name"]`)
        ?.focus();
    });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (matchesKeybind(e, keybinds.ADD_SIBLING)) {
      e.preventDefault();
      onAddSibling();
      return;
    }
    if (matchesKeybind(e, keybinds.INDENT)) {
      e.preventDefault();
      onIndent();
      focusNameField();
      return;
    }
    if (matchesKeybind(e, keybinds.UNINDENT)) {
      e.preventDefault();
      onUnindent();
      focusNameField();
      return;
    }
    if (e.key === "Backspace" && e.currentTarget.value === "" && node.children.length === 0) {
      e.preventDefault();
      onDeleteEmpty();
    }
  };

  return (
    <div
      data-geo-editor="game-spec-card"
      className={cn(
        specCardOuterClass("gamedev", { themedChrome: !hideThemedChrome }),
        !hideThemedChrome && "border-l-2",
        "transition-colors duration-150 ease-in-out hover:bg-zinc-700/45",
      )}
      style={
        hideThemedChrome
          ? { boxShadow: "none" }
          : {
              borderLeftColor: themeChromeRgba(accentColor, 1, chrome),
              borderColor: themeChromeRgba(accentColor, 0.42, chrome),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px ${themeChromeRgba(accentColor, 0.1, chrome)}`,
            }
      }
    >
      <div className="pointer-events-none mb-1 flex items-center gap-1.5">
        <div
          className="h-1 w-1 rotate-45"
          style={
            hideThemedChrome
              ? { backgroundColor: "transparent", boxShadow: "none" }
              : {
                  backgroundColor: themeChromeRgba(accentColor, 1, chrome),
                  boxShadow: `0 0 8px ${themeChromeRgba(accentColor, 0.55, chrome)}`,
                }
          }
          aria-hidden
        />
        <span
          className="font-mono text-[8px] tracking-[3px]"
          style={{ color: hexToRgba(accentSolid, 0.88) }}
        >
          {t("spec.badge")}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="block">
          <span className={SPEC_CARD_LABEL_CLASS}>{t("spec.labelName")}</span>
          <input
            type="text"
            data-card-focus-target="name"
            value={g.name}
            readOnly={readOnly}
            onChange={(e) => onPatch({ name: e.target.value })}
            onKeyDown={handleNameKeyDown}
            placeholder={t("spec.namePh")}
            className="w-full border border-zinc-700/70 bg-zinc-950/50 px-2 py-1 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-600/45 focus:ring-1 focus:ring-amber-500/18 read-only:cursor-default read-only:opacity-90"
          />
        </label>

        <label className="block">
          <span className={SPEC_CARD_LABEL_CLASS}>{t("spec.labelCategory")}</span>
          <select
            value={g.category}
            disabled={readOnly}
            onChange={(e) => onPatch({ category: e.target.value }, "immediate")}
            className="w-full max-w-xs cursor-pointer border border-zinc-700/70 bg-zinc-950/50 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-amber-600/45 focus:ring-1 focus:ring-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {!GAME_SPEC_CATEGORIES.includes(g.category as (typeof GAME_SPEC_CATEGORIES)[number]) && (
              <option value={g.category}>{g.category}</option>
            )}
            {GAME_SPEC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={SPEC_CARD_LABEL_CLASS}>{t("spec.labelStats")}</span>
          <input
            type="text"
            value={g.stats}
            readOnly={readOnly}
            onChange={(e) => onPatch({ stats: e.target.value })}
            placeholder={t("spec.statsPh")}
            className="w-full border border-zinc-700/70 bg-zinc-950/50 px-2 py-1 font-mono text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-cyan-600/35 focus:ring-1 focus:ring-cyan-500/15 read-only:cursor-default read-only:opacity-90"
          />
        </label>

        <label className="block">
          <span className={SPEC_CARD_LABEL_CLASS}>{t("spec.labelDescription")}</span>
          <textarea
            value={g.description}
            readOnly={readOnly}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder={t("spec.descPh")}
            rows={3}
            className="w-full resize-y border border-zinc-700/70 bg-zinc-950/50 px-2 py-1 font-mono text-xs leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-violet-600/35 focus:ring-1 focus:ring-violet-500/15 read-only:cursor-default read-only:opacity-90"
          />
        </label>
      </div>
    </div>
  );
}
