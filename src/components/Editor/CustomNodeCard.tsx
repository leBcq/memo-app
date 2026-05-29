"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { themeChromeRgba, isThemeChromeInvisible } from "@/lib/memoThemeColor";
import type { CustomCardData, CustomCardProperty } from "@/types/note";
import { useTranslation } from "@/i18n/useTranslation";

type Props = {
  data: CustomCardData;
  accentColor: string;
  chromeAlphaMult?: number;
  onPatchTitle: (title: string) => void;
  onAddProperty: () => void;
  onRemoveProperty: (propId: string) => void;
  onPatchProperty: (
    propId: string,
    patch: Partial<Omit<CustomCardProperty, "id">>,
    historyMode?: "immediate" | "none",
  ) => void;
  onRemoveCard: () => void;
  readOnly?: boolean;
};

export function CustomNodeCard({
  data,
  accentColor,
  chromeAlphaMult = 1,
  onPatchTitle,
  onAddProperty,
  onRemoveProperty,
  onPatchProperty,
  onRemoveCard,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const chrome = chromeAlphaMult;
  const hideChrome = isThemeChromeInvisible(chrome);

  return (
    <div
      data-geo-editor="custom-card"
      className={cn(
        "min-h-[22px] flex-1 rounded-md border border-cyan-500/20 bg-zinc-900/40 px-2.5 py-2",
        "shadow-[inset_0_1px_0_rgba(6,182,212,0.06),0_0_24px_rgba(6,182,212,0.04)]",
        "transition-colors duration-150 ease-in-out hover:bg-zinc-800/50",
      )}
      style={
        hideChrome
          ? { boxShadow: "none" }
          : {
              borderColor: themeChromeRgba(accentColor, 0.38, chrome),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${themeChromeRgba(accentColor, 0.08, chrome)}`,
            }
      }
    >
      {/* Header row: title + remove-card button */}
      <div className="mb-2 flex items-center gap-1.5">
        <input
          type="text"
          data-card-focus-target="name"
          value={data.title}
          readOnly={readOnly}
          onChange={(e) => onPatchTitle(e.target.value)}
          placeholder={t("card.titlePh")}
          className="min-w-0 flex-1 border border-zinc-700/60 bg-zinc-950/40 px-2 py-1 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-600/40 focus:ring-1 focus:ring-cyan-500/20 read-only:cursor-default read-only:opacity-90"
        />
        {!readOnly && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (window.confirm(t("card.removeCardConfirm"))) onRemoveCard();
            }}
            title={t("card.removeCard")}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-red-950/40 hover:text-red-400"
          >
            <X size={11} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>

      {/* Property rows */}
      <div className="space-y-1.5">
        {data.properties.map((prop) => (
          <div key={prop.id} className="flex items-start gap-1.5">
            {/* Label */}
            <input
              type="text"
              value={prop.label}
              readOnly={readOnly}
              onChange={(e) => onPatchProperty(prop.id, { label: e.target.value })}
              placeholder={t("card.propLabelPh")}
              className="w-[72px] shrink-0 border border-zinc-700/60 bg-zinc-950/40 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400 outline-none placeholder:text-zinc-700 focus:border-cyan-700/40 read-only:cursor-default read-only:opacity-90"
            />
            {/* Value */}
            <div className="min-w-0 flex-1">
              {prop.type === "textarea" ? (
                <textarea
                  value={prop.value}
                  readOnly={readOnly}
                  onChange={(e) => onPatchProperty(prop.id, { value: e.target.value })}
                  placeholder={t("card.propValuePh")}
                  rows={2}
                  className="w-full resize-y border border-zinc-700/60 bg-zinc-950/40 px-1.5 py-0.5 font-mono text-[11px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-cyan-700/40 read-only:cursor-default read-only:opacity-90"
                />
              ) : (
                <input
                  type="text"
                  value={prop.value}
                  readOnly={readOnly}
                  onChange={(e) => onPatchProperty(prop.id, { value: e.target.value })}
                  placeholder={t("card.propValuePh")}
                  className="w-full border border-zinc-700/60 bg-zinc-950/40 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-cyan-700/40 read-only:cursor-default read-only:opacity-90"
                />
              )}
            </div>
            {/* Type toggle + remove */}
            {!readOnly && (
              <div className="flex shrink-0 flex-col gap-px">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() =>
                    onPatchProperty(
                      prop.id,
                      { type: prop.type === "textarea" ? "text" : "textarea" },
                      "immediate",
                    )
                  }
                  title={
                    prop.type === "textarea"
                      ? t("card.typeToggleSingle")
                      : t("card.typeToggleMulti")
                  }
                  className="flex h-[14px] w-5 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  <span className="font-mono text-[8px]">
                    {prop.type === "textarea" ? "T" : "¶"}
                  </span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => onRemoveProperty(prop.id)}
                  title={t("card.removeProperty")}
                  className="flex h-[14px] w-5 items-center justify-center text-zinc-600 transition-colors hover:text-red-400"
                >
                  <X size={8} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add property button */}
      {!readOnly && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onAddProperty}
          className="mt-2 flex items-center gap-1 font-mono text-[9px] tracking-wider text-zinc-600 transition-colors hover:text-cyan-400"
        >
          <Plus size={9} strokeWidth={2.5} aria-hidden />
          <span>{t("card.addProperty")}</span>
        </button>
      )}
    </div>
  );
}
