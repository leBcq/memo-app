"use client";

import { Star } from "lucide-react";
import { matchesKeybind } from "@/config/keybinds";
import type { KeymapSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { themeChromeRgba, isThemeChromeInvisible } from "@/lib/memoThemeColor";
import { SPEC_CARD_LABEL_CLASS, specCardOuterClass } from "@/components/Editor/specCardStyles";
import {
  PLUGIN_CATEGORIES,
  type NoteNode,
  type NotePluginData,
} from "@/types/note";
import { useTranslation } from "@/i18n/useTranslation";

type PluginCardKeybinds = Pick<KeymapSettings, "ADD_SIBLING" | "INDENT" | "UNINDENT">;

type PluginNodeCardProps = {
  node: NoteNode & { pluginData: NotePluginData };
  keybinds: PluginCardKeybinds;
  /** Memo theme accent — card border / glow. */
  accentColor: string;
  /** Sidebar row-tint alpha multiplier for border / glow only. */
  chromeAlphaMult?: number;
  onPatch: (patch: Partial<NotePluginData>, historyMode?: "immediate" | "none") => void;
  onAddSibling: () => void;
  onIndent: () => void;
  onUnindent: () => void;
  onDeleteEmpty: () => void;
};

export function PluginNodeCard({
  node,
  keybinds,
  accentColor,
  chromeAlphaMult = 1,
  onPatch,
  onAddSibling,
  onIndent,
  onUnindent,
  onDeleteEmpty,
}: PluginNodeCardProps) {
  const { t } = useTranslation();
  const p = node.pluginData;
  const chrome = chromeAlphaMult;
  const hideThemedChrome = isThemeChromeInvisible(chrome);

  const focusNameField = () => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-node-id="${node.id}"] [data-card-focus-target="name"]`)
        ?.focus();
    });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      data-geo-editor="plugin-card"
      className={cn(
        specCardOuterClass("music"),
        "transition-colors duration-150 ease-in-out hover:bg-zinc-700/45",
      )}
      style={
        hideThemedChrome
          ? { boxShadow: "none" }
          : {
              borderColor: themeChromeRgba(accentColor, 0.48, chrome),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${themeChromeRgba(accentColor, 0.1, chrome)}`,
            }
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="block">
            <span className={SPEC_CARD_LABEL_CLASS}>{t("plugin.labelName")}</span>
            <input
              type="text"
              data-card-focus-target="name"
              value={p.name}
              onChange={(e) => onPatch({ name: e.target.value })}
              onKeyDown={handleNameKeyDown}
              placeholder={t("plugin.namePh")}
              className="w-full border border-zinc-700/70 bg-zinc-950/40 px-2 py-1 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-600/40 focus:ring-1 focus:ring-cyan-500/20"
            />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[120px] flex-1">
              <span className={SPEC_CARD_LABEL_CLASS}>{t("plugin.labelCategory")}</span>
              <select
                value={p.category}
                onChange={(e) => onPatch({ category: e.target.value }, "immediate")}
                className="w-full cursor-pointer border border-zinc-700/70 bg-zinc-950/40 px-2 py-1 font-mono text-xs text-zinc-200 outline-none focus:border-fuchsia-600/40 focus:ring-1 focus:ring-fuchsia-500/20"
              >
                {!PLUGIN_CATEGORIES.includes(p.category as (typeof PLUGIN_CATEGORIES)[number]) && (
                  <option value={p.category}>{p.category}</option>
                )}
                {PLUGIN_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              title={p.isFavorite ? t("plugin.favoriteRemove") : t("plugin.favoriteAdd")}
              onClick={() => onPatch({ isFavorite: !p.isFavorite }, "immediate")}
              className={cn(
                "mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-all",
                p.isFavorite
                  ? "border-amber-400/50 bg-amber-950/35 text-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.45),inset_0_0_12px_rgba(167,139,250,0.12)]"
                  : "border-zinc-700/80 bg-zinc-900/40 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400",
              )}
            >
              <Star
                size={16}
                strokeWidth={1.75}
                className={cn(p.isFavorite && "fill-current")}
                aria-hidden
              />
            </button>
          </div>

          <label className="block">
            <span className={SPEC_CARD_LABEL_CLASS}>{t("plugin.labelPurpose")}</span>
            <textarea
              value={p.purpose}
              onChange={(e) => onPatch({ purpose: e.target.value })}
              placeholder={t("plugin.purposePh")}
              rows={2}
              className="w-full resize-y border border-zinc-700/70 bg-zinc-950/40 px-2 py-1 font-mono text-xs leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-violet-600/35 focus:ring-1 focus:ring-violet-500/15"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
