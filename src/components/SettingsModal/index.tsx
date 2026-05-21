"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSettings,
  keyComboToLabel,
  DEFAULT_KEYMAP,
  DEFAULT_APPEARANCE,
  type KeymapSettings,
} from "@/contexts/SettingsContext";
import type { KeyCombo } from "@/config/keybinds";
import { useTranslation } from "@/i18n/useTranslation";

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabId = "general" | "appearance" | "keymap" | "account";

// ── Single keybind row ────────────────────────────────────────────────────────

type KeymapRowProps = {
  actionKey: keyof KeymapSettings;
  label: string;
  desc: string;
  currentCombo: KeyCombo;
  isCapturing: boolean;
  onStartCapture: () => void;
  onCapture: (combo: KeyCombo) => void;
  onCancelCapture: () => void;
};

function KeymapRow({
  label, desc, currentCombo, isCapturing,
  onStartCapture, onCapture, onCancelCapture,
}: KeymapRowProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Imperatively focus the capture input as soon as capture mode starts
  useEffect(() => {
    if (isCapturing) inputRef.current?.focus();
  }, [isCapturing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Always swallow the event so Tab/Enter/etc. don't escape
    e.preventDefault();
    e.stopPropagation();

    // Modifier-only presses don't form a complete combo
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

    const combo: KeyCombo = {
      key: e.key,
      ...(e.shiftKey             && { shift: true }),
      ...((e.ctrlKey || e.metaKey) && { ctrl:  true }),
      ...(e.altKey               && { alt:   true }),
    };
    onCapture(combo);
  };

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-zinc-800/70 bg-zinc-900/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] tracking-wide text-zinc-200">{label}</span>
        <span className="text-[10px] text-zinc-600">{desc}</span>
      </div>

      {isCapturing ? (
        <input
          ref={inputRef}
          readOnly
          value=""
          placeholder={t("settings.keymap.capture")}
          onKeyDown={handleKeyDown}
          onBlur={onCancelCapture}
          className="w-full min-h-11 shrink-0 border border-cyan-500/60 bg-cyan-950/20 px-3 py-2 font-mono text-[11px] text-cyan-400 outline-none ring-1 ring-cyan-500/30 placeholder:animate-pulse placeholder:text-cyan-400/60 sm:w-[116px]"
        />
      ) : (
        <button
          type="button"
          onClick={onStartCapture}
          title={t("settings.keymap.rebindTitle")}
          className="group flex min-h-11 w-full shrink-0 items-center justify-center border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] transition-colors hover:border-cyan-600/50 hover:bg-zinc-800 sm:w-[116px] sm:min-h-0 sm:py-1.5"
        >
          <kbd className="font-mono text-zinc-300 group-hover:text-cyan-300">
            {keyComboToLabel(currentCombo)}
          </kbd>
        </button>
      )}
    </div>
  );
}

// ── Tab component ─────────────────────────────────────────────────────────────

function KeymapTab() {
  const { t } = useTranslation();
  const { settings, updateKeymap } = useSettings();
  const [capturingKey, setCapturingKey] = useState<keyof KeymapSettings | null>(null);

  const keymapActions = useMemo(
    () =>
      [
        { key: "ADD_SIBLING" as const, label: t("settings.keymap.addSibling"), desc: t("settings.keymap.addSiblingDesc") },
        { key: "SOFT_BREAK" as const, label: t("settings.keymap.softBreak"), desc: t("settings.keymap.softBreakDesc") },
        { key: "INDENT" as const, label: t("settings.keymap.indent"), desc: t("settings.keymap.indentDesc") },
        { key: "UNINDENT" as const, label: t("settings.keymap.unindent"), desc: t("settings.keymap.unindentDesc") },
        { key: "FOCUS_NODE" as const, label: t("settings.keymap.focus"), desc: t("settings.keymap.focusDesc") },
        { key: "UNFOCUS_NODE" as const, label: t("settings.keymap.unfocus"), desc: t("settings.keymap.unfocusDesc") },
      ] as const,
    [t],
  );

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("settings.keyBindings")}</SectionTitle>
      <p className="text-[10px] text-zinc-600 tracking-wide">
        {t("settings.keymapHint")}
      </p>

      <div className="flex flex-col gap-2">
        {keymapActions.map(({ key, label, desc }) => (
          <KeymapRow
            key={key}
            actionKey={key}
            label={label}
            desc={desc}
            currentCombo={settings.keymap[key]}
            isCapturing={capturingKey === key}
            onStartCapture={() => setCapturingKey(key)}
            onCapture={(combo) => { updateKeymap({ [key]: combo }); setCapturingKey(null); }}
            onCancelCapture={() => setCapturingKey(null)}
          />
        ))}
      </div>

      <button type="button" onClick={() => { updateKeymap(DEFAULT_KEYMAP); setCapturingKey(null); }}
        className="self-start border border-zinc-800 px-3 py-1 text-[10px] tracking-wide text-zinc-600 transition-colors hover:border-zinc-600 hover:text-zinc-300">
        {t("settings.keymapReset")}
      </button>
    </div>
  );
}

// ─── Appearance tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { t } = useTranslation();
  const { settings, updateAppearance } = useSettings();
  const { baseFontSize, fontFamily, editorWidth } = settings.appearance;

  const fontFamilyOptions = useMemo(
    () =>
      [
        { value: "mono" as const, label: t("settings.fontMono"), preview: "ABCabc 123" },
        { value: "sans" as const, label: t("settings.fontSans"), preview: "ABCabc 123" },
      ],
    [t],
  );

  const editorWidthOptions = useMemo(
    () =>
      [
        { value: "narrow" as const, label: t("settings.widthNarrow"), icon: "▏  ▕" },
        { value: "wide" as const, label: t("settings.widthWide"), icon: "▏   ▕" },
        { value: "full" as const, label: t("settings.widthFull"), icon: "▏────▕" },
      ],
    [t],
  );

  const resetAppearance = () => updateAppearance(DEFAULT_APPEARANCE);

  return (
    <div className="flex flex-col gap-6">
      {/* Font size */}
      <div>
        <SectionTitle>{t("settings.fontSize")}</SectionTitle>
        <div className="mt-3 flex items-center gap-4">
          <input
            type="range" min={10} max={24} step={1} value={baseFontSize}
            onChange={(e) => updateAppearance({ baseFontSize: Number(e.target.value) })}
            className="h-[3px] flex-1 cursor-pointer appearance-none bg-zinc-800 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-500 [&::-webkit-slider-thumb]:bg-zinc-300"
            style={{ accentColor: "#06b6d4" }}
          />
          <div className="flex h-7 w-14 items-center border border-zinc-700 bg-zinc-900">
            <input
              type="number" min={10} max={24} value={baseFontSize}
              onChange={(e) => {
                const v = Math.min(24, Math.max(10, Number(e.target.value) || 14));
                updateAppearance({ baseFontSize: v });
              }}
              className="w-full bg-transparent text-center font-mono text-[11px] text-zinc-200 outline-none"
            />
          </div>
          <span className="text-[10px] text-zinc-600">px</span>
        </div>
        <div className="mt-3 border border-zinc-800/60 bg-zinc-900/20 p-3"
          style={{ fontSize: `${baseFontSize}px`, fontFamily: "var(--editor-font-family)" }}>
          <span className="text-zinc-400">{t("settings.preview")} </span>
          <span className="text-zinc-200">{t("settings.previewSample")}</span>
        </div>
      </div>

      {/* Font family */}
      <div>
        <SectionTitle>{t("settings.fontFamily")}</SectionTitle>
        <div className="mt-3 flex gap-2">
          {fontFamilyOptions.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => updateAppearance({ fontFamily: opt.value })}
              className={cn(
                "flex flex-1 flex-col items-center gap-1.5 border py-3 text-[10px] tracking-wide transition-colors",
                fontFamily === opt.value
                  ? "border-cyan-600/60 bg-cyan-950/20 text-cyan-300"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300",
              )}
            >
              <span className="text-[13px]"
                style={{ fontFamily: opt.value === "mono" ? "var(--font-geist-mono)" : "var(--font-geist-sans)" }}>
                {opt.preview}
              </span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor width */}
      <div>
        <SectionTitle>{t("settings.editorWidth")}</SectionTitle>
        <div className="mt-3 flex gap-2">
          {editorWidthOptions.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => updateAppearance({ editorWidth: opt.value })}
              className={cn(
                "flex flex-1 flex-col items-center gap-1.5 border py-3 text-[10px] tracking-wide transition-colors",
                editorWidth === opt.value
                  ? "border-cyan-600/60 bg-cyan-950/20 text-cyan-300"
                  : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300",
              )}
            >
              <span className="font-mono text-[12px] tracking-widest">{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={resetAppearance}
        className="self-start border border-zinc-800 px-3 py-1 text-[10px] tracking-wide text-zinc-600 transition-colors hover:border-zinc-600 hover:text-zinc-300">
        {t("settings.resetAppearance")}
      </button>
    </div>
  );
}

// ─── Placeholder tabs ─────────────────────────────────────────────────────────

function GeneralTab() {
  const { t } = useTranslation();
  const { settings, updateAppearance } = useSettings();
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("settings.sectionGeneral")}</SectionTitle>

      <div className="border border-zinc-800/70 bg-zinc-900/30 px-4 py-3">
        <div className="mb-2.5">
          <span className="text-[11px] tracking-wide text-zinc-200">{t("settings.language")}</span>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">{t("settings.languageHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["en", "ja"] as const).map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => updateAppearance({ locale: loc })}
              className={cn(
                "min-w-[100px] flex-1 border px-3 py-2 text-[10px] tracking-wide transition-colors",
                settings.appearance.locale === loc
                  ? "border-cyan-600/60 bg-cyan-950/25 text-cyan-200"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300",
              )}
            >
              {loc === "en" ? t("settings.langEnglish") : t("settings.langJapanese")}
            </button>
          ))}
        </div>
      </div>

      <PlaceholderRow label={t("settings.placeholderAutoSave")} />
      <PlaceholderRow label={t("settings.placeholderTemplate")} />
      <PlaceholderRow label={t("settings.placeholderStartup")} />

      <SectionTitle>{t("settings.sectionFocus")}</SectionTitle>
      <div
        className="flex cursor-pointer items-center justify-between border border-zinc-800/70 bg-zinc-900/30 px-4 py-3"
        onClick={() => updateAppearance({ bulletClickFocus: !settings.appearance.bulletClickFocus })}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            updateAppearance({ bulletClickFocus: !settings.appearance.bulletClickFocus });
          }
        }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] tracking-wide text-zinc-200">{t("settings.bulletFocusTitle")}</span>
          <span className="text-[10px] text-zinc-600">
            {t("settings.bulletFocusDesc")}
          </span>
        </div>
        <div className={cn(
          "relative h-5 w-9 shrink-0 border transition-colors",
          settings.appearance.bulletClickFocus ? "border-cyan-600/60 bg-cyan-950/40" : "border-zinc-700/60 bg-zinc-900",
        )}>
          <div className={cn(
            "absolute top-0.5 h-4 w-4 border transition-all",
            settings.appearance.bulletClickFocus ? "left-4 border-cyan-400/80 bg-cyan-900/60" : "left-0.5 border-zinc-600/60 bg-zinc-700",
          )} />
        </div>
      </div>

      <ComingSoon />
    </div>
  );
}

function AccountTab({ onExportFullBackup }: { onExportFullBackup: () => void }) {
  const { t } = useTranslation();
  const { resetSettings } = useSettings();
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>{t("settings.accountTitle")}</SectionTitle>
      <PlaceholderRow label={t("settings.cloudSync")} tag={t("settings.tagComingSoon")} />

      <div className="border border-zinc-800/70 bg-zinc-900/25 px-4 py-3">
        <div className="mb-2.5">
          <span className="text-[11px] tracking-wide text-zinc-200">{t("settings.localBackupTitle")}</span>
          <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
            {t("settings.localBackupDesc")}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportFullBackup}
          className="flex items-center gap-2 border border-zinc-700/80 bg-zinc-900/50 px-3 py-2 text-[10px] tracking-wide text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <Download size={13} className="shrink-0 opacity-70" strokeWidth={2} />
          <span>{t("settings.exportDataJson")}</span>
        </button>
      </div>

      <PlaceholderRow label={t("settings.importBackup")} />
      <div className="border border-red-900/40 bg-red-950/10 px-4 py-3">
        <div className="mb-2 text-[11px] text-red-400/90">{t("settings.dangerZone")}</div>
        <button type="button" onClick={() => {
          if (window.confirm(t("settings.resetConfirm"))) resetSettings();
        }}
          className="border border-red-800/60 px-3 py-1 text-[10px] text-red-400/80 transition-colors hover:border-red-600 hover:text-red-300">
          {t("settings.resetAllSettings")}
        </button>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 font-mono text-[11px] font-semibold tracking-[2px] text-zinc-400">
        {String(children).toUpperCase()}
      </h3>
      <div className="h-px bg-zinc-800" />
    </div>
  );
}

function PlaceholderRow({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center justify-between border border-zinc-800/70 bg-zinc-900/30 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tracking-wide text-zinc-400">{label}</span>
        {tag && <span className="border border-zinc-700/50 px-1 py-0.5 text-[9px] tracking-widest text-zinc-600">{tag}</span>}
      </div>
      <div className="h-5 w-20 border border-zinc-700/40 bg-zinc-800/40" />
    </div>
  );
}

function ComingSoon() {
  const { t } = useTranslation();
  return (
    <p className="font-mono text-[10px] tracking-widest text-zinc-700">
      {t("settings.comingSoon")}
    </p>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Props = {
  onClose: () => void;
  onExportFullBackup: () => void;
};

export function SettingsModal({ onClose, onExportFullBackup }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");
  const overlayRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(
    () =>
      [
        { id: "general" as const, label: t("settings.tabGeneral"), icon: "⚙" },
        { id: "appearance" as const, label: t("settings.tabAppearance"), icon: "◈" },
        { id: "keymap" as const, label: t("settings.tabKeymap"), icon: "⌨" },
        { id: "account" as const, label: t("settings.tabAccount"), icon: "◎" },
      ],
    [t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const renderContent = () => {
    switch (activeTab) {
      case "general":    return <GeneralTab />;
      case "appearance": return <AppearanceTab />;
      case "keymap":     return <KeymapTab />;
      case "account":    return <AccountTab onExportFullBackup={onExportFullBackup} />;
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000] flex flex-col bg-black/70 p-3 pb-10 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6 sm:pb-6 md:p-8"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border border-zinc-700/80 bg-zinc-950 font-mono shadow-2xl shadow-black/80",
          "max-h-[min(92vh,780px)] sm:max-h-[90vh]",
          "md:h-[580px] md:max-h-[90vh] md:w-[800px] md:max-w-[96vw] md:flex-row md:flex-none",
        )}
      >
        {/* Corner accents — desktop */}
        <div className="pointer-events-none absolute -left-px -top-px hidden h-6 w-6 border-l-2 border-t-2 border-cyan-500/40 md:block" />
        <div className="pointer-events-none absolute -right-px -top-px hidden h-6 w-6 border-r-2 border-t-2 border-cyan-500/40 md:block" />
        <div className="pointer-events-none absolute -bottom-px -left-px hidden h-6 w-6 border-b-2 border-l-2 border-cyan-500/40 md:block" />
        <div className="pointer-events-none absolute -bottom-px -right-px hidden h-6 w-6 border-b-2 border-r-2 border-cyan-500/40 md:block" />

        {/* Mobile tabs (top rail) */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-zinc-800/70 bg-zinc-900/40 px-2 py-2 touch-pan-x md:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-sm border px-3 py-2 text-[12px] font-mono tracking-wide whitespace-nowrap",
                activeTab === tab.id
                  ? "border-cyan-500/50 bg-cyan-950/30 text-cyan-200"
                  : "border-transparent text-zinc-500 hover:bg-zinc-900/65 hover:text-zinc-300",
              )}
            >
              <span className="text-[14px]" aria-hidden>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Desktop tab sidebar */}
        <div className="hidden h-full min-h-0 w-44 shrink-0 flex-col border-r border-zinc-800/70 bg-zinc-900/30 py-3 md:flex">
          <div className="mb-3 px-4 text-[9px] tracking-[3px] text-zinc-600">{t("settings.title")}</div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 border-l-2 px-4 py-2.5 text-left text-[11px] tracking-wide transition-all duration-150",
                activeTab === tab.id
                  ? "border-cyan-500/60 bg-cyan-950/20 text-cyan-300 [box-shadow:inset_2px_0_8px_rgba(6,182,212,0.06)]"
                  : "border-transparent text-zinc-500 hover:border-zinc-700/50 hover:bg-zinc-900/50 hover:text-zinc-300",
              )}
            >
              <span className="text-[13px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <div className="mt-auto border-t border-zinc-800/60 px-4 pt-3 text-[9px] text-zinc-700">{t("settings.version")}</div>
        </div>

        {/* Content column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-[48px] shrink-0 items-center justify-between gap-2 border-b border-zinc-800/70 px-3 py-2 sm:px-6 sm:py-3">
            <span className="min-w-0 truncate whitespace-nowrap text-[11px] tracking-wide text-zinc-600 sm:text-[9px] sm:tracking-[3px]">
              <span className="md:hidden">{tabs.find((x) => x.id === activeTab)?.label}</span>
              <span className="hidden md:inline">
                {tabs.find((x) => x.id === activeTab)?.label.toUpperCase()}
              </span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-sm text-[14px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200 md:h-9 md:w-9 md:text-[10px]"
              aria-label={t("settings.close")}
            >
              ✕
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-5">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
