"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NoteNode } from "@/types/note";
import type { MemoType } from "@/types/memoKind";
import { cn } from "@/lib/utils";
import { useTextFormatting } from "@/hooks/useTextFormatting";
import { MENU_COLOR_PRESETS, hexToRgba, parseStoredColor } from "@/lib/menuColorUtils";
import {
  HexInput,
  OpacityRow,
  menuSquarePickerClass,
  menuSwatchClass,
} from "@/components/MenuColorPicker/primitives";
import { RowTintColorPicker } from "@/components/MenuColorPicker/RowTintColorPicker";
import { useTranslation } from "@/i18n/useTranslation";
import { useGlossaryStore } from "@/stores/glossaryStore";
import type { FormatCommand } from "@/hooks/useTextFormatting";
import {
  applyFontSizeWholeBodies,
  applyForeColorWholeBodies,
  applyFormatWholeBodies,
  applyHiliteWholeBodies,
  collectBodyHtmlPatches,
} from "@/lib/editorBatchFormat";

type Props = {
  node: NoteNode;
  anchorRect: DOMRect;
  onClose: () => void;
  onIndent: () => void;
  onUnindent: () => void;
  onToggleCollapsed: () => void;
  onToggleHasCheckbox: () => void;
  onToggleCompleted: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onToggleNote: () => void;
  onSetBgColor: (color: string | null, opts?: { skipHistory?: boolean }) => void;
  onSetHeading: (level: NoteNode["headingLevel"]) => void;
  onDelete: () => void;
  onFocusNode: () => void;
  memoType?: MemoType;
  /** Replace current node body with a new generic custom card. */
  onAddCard?: () => void;
  onMemoColorSliderUndoGestureStart?: () => void;
  onMemoColorSliderUndoGestureEnd?: () => void;
  /** When length ≥ 2, TEXT/inline tools apply to all these bodies in one commit. */
  textBatchTargetIds: string[];
  onPatchNodeContents: (patches: Record<string, string>) => void;
};

const sectionOpenState: Record<string, boolean> = {
  STRUCTURE: true,
  TASK: false,
  NODE: false,
  TEXT: false,
  STYLE: false,
};

// Persists the last dragged position across open/close cycles (module-level).
// First open uses anchorRect; subsequent opens use the last dragged position.
let _persistedMenuPos: { x: number; y: number } | null = null;

export function NodeContextMenu({
  node, anchorRect, onClose,
  onIndent, onUnindent, onToggleCollapsed,
  onToggleHasCheckbox, onToggleCompleted,
  onAddChild, onAddSibling, onToggleNote,
  onSetBgColor, onSetHeading, onDelete, onFocusNode,
  memoType = "standard",
  onAddCard,
  onMemoColorSliderUndoGestureStart,
  onMemoColorSliderUndoGestureEnd,
  textBatchTargetIds,
  onPatchNodeContents,
}: Props) {
  const { t } = useTranslation();
  const glossaryEnabled = useGlossaryStore((s) => s.enabled);
  const toggleGlossary = useGlossaryStore((s) => s.toggle);
  const ref = useRef<HTMLDivElement>(null);
  const fgPickerRef = useRef<HTMLInputElement>(null);
  const hlPickerRef = useRef<HTMLInputElement>(null);
  // Saved selection – captured on menu mount and updated after every execCommand
  const savedRangeRef = useRef<Range | null>(null);

  const { applyFormat, applyFontSize, applyFontColor, applyHighlightColor } =
    useTextFormatting(savedRangeRef);

  const isTextBatch = textBatchTargetIds.length >= 2;
  const syncTextBodies = () => {
    onPatchNodeContents(collectBodyHtmlPatches(textBatchTargetIds));
  };

  const runBatchFormat = (cmd: FormatCommand) => {
    applyFormatWholeBodies(textBatchTargetIds, cmd);
    syncTextBodies();
  };

  // ── Drag state ────────────────────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    // Reuse the last dragged position if available; otherwise place near click
    if (_persistedMenuPos) return _persistedMenuPos;
    return {
      x: Math.min(
        anchorRect.left + 20,
        (typeof window !== "undefined" ? window.innerWidth : 800) - 228,
      ),
      y: anchorRect.bottom + 2,
    };
  });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // ── TEXT color state ──────────────────────────────────────────────────────
  const [fontSize, setFontSize] = useState(14);
  const [fgColor, setFgColor] = useState("#e0e0e6");
  const [fgHex, setFgHex] = useState("e0e0e6");

  // ── HIGHLIGHT state ───────────────────────────────────────────────────────
  const [activeHlColor, setActiveHlColor] = useState<string | null>(null);
  const [hlHex, setHlHex] = useState("");
  const [hlOpacity, setHlOpacity] = useState(60);

  // Drag move/up listeners on window
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const menuW = 228;
      const menuH = ref.current?.offsetHeight ?? 400;
      const next = {
        x: Math.max(0, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - menuW)),
        y: Math.max(0, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - menuH)),
      };
      _persistedMenuPos = next; // Persist so next open reuses this position
      setPos(next);
    };
    const onUp = () => { isDraggingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Close on outside mousedown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const id = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // On menu mount: snapshot current selection + initialise fontSize / highlight
  useEffect(() => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // ── 1. Save the Range so every execCommand can restore it ────────────
      savedRangeRef.current = range.cloneRange();

      // ── 2. Walk up from the selection to read current inline styles ───────
      let el: HTMLElement | null =
        range.startContainer.nodeType === Node.TEXT_NODE
          ? (range.startContainer as Text).parentElement
          : (range.startContainer as HTMLElement);

      let foundFontSize = false;
      let foundHighlight = false;

      while (el instanceof HTMLElement) {
        // Font size
        if (!foundFontSize && el.style?.fontSize) {
          const px = parseFloat(el.style.fontSize);
          if (px >= 8 && px <= 200) {
            setFontSize(Math.round(px));
            foundFontSize = true;
          }
        }

        // Highlight background-color
        if (!foundHighlight) {
          const bg = el.style?.backgroundColor;
          if (bg && bg !== "transparent" && bg !== "") {
            const parsed = parseStoredColor(bg);
            if (parsed) {
              setActiveHlColor(parsed.hex);
              setHlHex(parsed.hex.replace("#", ""));
              setHlOpacity(parsed.opacity);
              foundHighlight = true;
            }
          }
        }

        if (foundFontSize && foundHighlight) break;
        if (el.contentEditable === "true") break;
        el = el.parentElement;
      }
    } catch { /* ignore */ }
  }, []);

  // ── Color apply helpers ───────────────────────────────────────────────────

  const applyFg = (hex: string) => {
    const full = hex.startsWith("#") ? hex : `#${hex}`;
    setFgColor(full);
    setFgHex(full.replace("#", ""));
    if (isTextBatch) {
      applyForeColorWholeBodies(textBatchTargetIds, full);
      syncTextBodies();
      return;
    }
    applyFontColor(full);
    // Selection is preserved by onMouseDown e.preventDefault() on the menu root
  };

  const applyHl = (hex: string, opacity: number) => {
    setActiveHlColor(hex);
    setHlHex(hex.replace("#", ""));
    const rgba = hexToRgba(hex, opacity);
    if (isTextBatch) {
      applyHiliteWholeBodies(textBatchTargetIds, rgba);
      syncTextBodies();
      return;
    }
    applyHighlightColor(rgba);
  };

  const clearBtnClass =
    "flex h-5 w-5 shrink-0 items-center justify-center border border-zinc-700/50 p-0 text-[9px] leading-none text-zinc-600 hover:border-zinc-400 hover:text-zinc-300";

  return (
    <div
      ref={ref}
      data-geo-node-context-menu
      className="fixed z-[9999] w-[220px] select-none border border-zinc-800 bg-zinc-950 py-0.5 font-mono shadow-xl shadow-black/60"
      style={{ top: pos.y, left: pos.x }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        const isInput = !!target.closest("input, textarea, select");
        const isButton = !!target.closest("button, a, [role='button']");

        // Preserve editor text selection for all non-input clicks
        if (!isInput) e.preventDefault();

        // Background / whitespace → start drag
        if (!isInput && !isButton) {
          isDraggingRef.current = true;
          dragOffsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }
      }}
    >
      {/* Drag handle strip */}
      <div className="flex h-[18px] cursor-grab items-center justify-center border-b border-zinc-800/60 bg-zinc-900/60 active:cursor-grabbing">
        <div className="grid grid-cols-4 gap-[3px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[3px] w-[3px] rounded-full bg-zinc-700/80" />
          ))}
        </div>
      </div>

      {/* ── STRUCTURE ── */}
      <AccordionSection sectionId="STRUCTURE" label={t("ctx.structure")}>
        <MenuItem icon="◎" kbd="Alt+→" onClick={() => { onFocusNode(); onClose(); }}>
          {t("ctx.focusThisNode")}
        </MenuItem>
        <MenuItem icon="→" kbd="Tab" onClick={onIndent}>{t("ctx.indent")}</MenuItem>
        <MenuItem icon="←" kbd="⇧Tab" onClick={onUnindent}>{t("ctx.outdent")}</MenuItem>
        <MenuItem icon={node.collapsed ? "▸" : "▾"} active={node.collapsed} onClick={onToggleCollapsed}>
          {node.collapsed ? t("ctx.expand") : t("ctx.collapse")}
        </MenuItem>
      </AccordionSection>

      {/* ── TASK ── */}
      <AccordionSection sectionId="TASK" label={t("ctx.task")}>
        <div
          className="flex cursor-pointer items-center gap-2 px-3 py-[5px] transition-colors hover:bg-zinc-900"
          onClick={(e) => { e.stopPropagation(); onToggleHasCheckbox(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleHasCheckbox(); } }}
          role="button" tabIndex={0}
        >
          <span className="w-3.5 text-center text-[11px] text-zinc-500 opacity-80">☐</span>
          <span className="flex-1 text-[11px] tracking-wide text-zinc-200">{t("ctx.checkbox")}</span>
          <ToggleSwitch on={node.hasCheckbox} />
        </div>
        <MenuItem icon={node.completed ? "↩" : "✓"} active={node.completed} disabled={!node.hasCheckbox}
          onClick={() => { if (node.hasCheckbox) onToggleCompleted(); }}>
          {node.completed ? t("ctx.uncomplete") : t("ctx.complete")}
        </MenuItem>
      </AccordionSection>

      {/* ── NODE ── */}
      <AccordionSection sectionId="NODE" label={t("ctx.node")}>
        <MenuItem icon="＋" onClick={onAddChild}>{t("ctx.addChild")}</MenuItem>
        <MenuItem icon="＋" onClick={onAddSibling}>{t("ctx.addSibling")}</MenuItem>
        <div
          className="flex cursor-pointer items-center gap-2 px-3 py-[5px] transition-colors hover:bg-zinc-900"
          onClick={(e) => { e.stopPropagation(); onToggleNote(); }}
          role="button" tabIndex={0}
        >
          <span className="w-3.5 text-center text-[11px] text-zinc-500 opacity-80">¶</span>
          <span className="flex-1 text-[11px] tracking-wide text-zinc-200">{t("ctx.addNoteToggle")}</span>
          <ToggleSwitch on={node.note !== null} />
        </div>
        {onAddCard && (
          <MenuItem
            icon="🧩"
            onClick={() => {
              onAddCard();
              onClose();
            }}
          >
            {t("ctx.addCard")}
          </MenuItem>
        )}
        {/* Glossary overlay global toggle */}
        <div
          className="flex cursor-pointer items-center gap-2 px-3 py-[5px] transition-colors hover:bg-zinc-900"
          onClick={(e) => { e.stopPropagation(); toggleGlossary(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGlossary(); } }}
          role="button"
          tabIndex={0}
        >
          <span className="w-3.5 text-center text-[11px] text-zinc-500 opacity-80">📖</span>
          <span className="flex-1 text-[11px] tracking-wide text-zinc-200">{t("ctx.glossaryToggle")}</span>
          <ToggleSwitch on={glossaryEnabled} />
        </div>
      </AccordionSection>

      {/* ── TEXT ── */}
      <AccordionSection sectionId="TEXT" label={t("ctx.text")}>
        {/* Format + font size */}
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5">
          {(["bold", "italic", "underline", "strikeThrough"] as const).map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => (isTextBatch ? runBatchFormat(cmd) : applyFormat(cmd))}
              className="px-2 py-1 text-[11px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-50">
              {cmd === "bold" ? <b>B</b> : cmd === "italic" ? <i>I</i> : cmd === "underline" ? <u>U</u> : <s>S</s>}
            </button>
          ))}
          <div className="mx-1 h-3.5 w-px shrink-0 bg-zinc-800" />
          <button type="button" onClick={() => {
            const s = Math.max(8, fontSize - 1);
            setFontSize(s);
            if (isTextBatch) {
              applyFontSizeWholeBodies(textBatchTargetIds, s);
              syncTextBodies();
            } else {
              applyFontSize(s);
            }
          }}
            className="flex w-4 items-center justify-center text-xs text-zinc-400 hover:text-zinc-100">−</button>
          <span className="w-5 text-center text-[10px] text-zinc-200">{fontSize}</span>
          <button type="button" onClick={() => {
            const s = Math.min(72, fontSize + 1);
            setFontSize(s);
            if (isTextBatch) {
              applyFontSizeWholeBodies(textBatchTargetIds, s);
              syncTextBodies();
            } else {
              applyFontSize(s);
            }
          }}
            className="flex w-4 items-center justify-center text-xs text-zinc-400 hover:text-zinc-100">+</button>
        </div>

        {/* Row 1 — round presets (apply only, no picker) */}
        <div className="flex items-center gap-2 px-3 pb-1.5">
          {MENU_COLOR_PRESETS.map((swatch) => (
            <button key={swatch} type="button"
              onClick={(e) => { e.stopPropagation(); applyFg(swatch); }}
              title={swatch}
              className={menuSwatchClass(fgColor === swatch)}
              style={{ background: swatch }}
            />
          ))}
        </div>

        {/* Row 2 — square picker (opens OS picker) + hex input */}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <div
            className={menuSquarePickerClass(true)}
            style={{ background: fgColor }}
            title="クリックでカラーピッカーを開く"
            onClick={() => fgPickerRef.current?.click()}
          >
            <input ref={fgPickerRef} type="color" value={fgColor}
              onChange={(e) => applyFg(e.target.value)}
              className="sr-only" />
          </div>
          <HexInput value={fgHex} onChange={(v) => { setFgHex(v); if (/^[0-9a-fA-F]{6}$/.test(v)) applyFg(`#${v}`); }} />
        </div>
      </AccordionSection>

      {/* ── STYLE ── */}
      <AccordionSection sectionId="STYLE" label={t("ctx.style")}>
        {/* Heading level */}
        <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5">
          {(["h1", "h2", "h3", null] as const).map((level) => (
            <button key={level ?? "body"} type="button" onClick={() => onSetHeading(level)}
              className={cn(
                "border px-1.5 py-0.5 text-[10px] transition-colors",
                node.headingLevel === level
                  ? "border-cyan-700 bg-cyan-950/30 text-zinc-100"
                  : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-50",
              )}>
              {level ?? "T"}
            </button>
          ))}
        </div>

        {/* ── HIGHLIGHT ── */}
        <div className="px-3 pb-2">
          <div className="mb-1.5 text-[9px] tracking-[2px] text-zinc-600">HIGHLIGHT</div>

          {/* Row 1 — round presets (apply only) + clear */}
          <div className="flex items-center gap-2 pb-1.5">
            {MENU_COLOR_PRESETS.map((swatch) => (
              <button key={swatch} type="button"
                onClick={(e) => { e.stopPropagation(); applyHl(swatch, hlOpacity); }}
                title={swatch}
                className={menuSwatchClass(activeHlColor === swatch)}
                style={{ background: swatch }}
              />
            ))}
            <button type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isTextBatch) {
                  applyHiliteWholeBodies(textBatchTargetIds, null);
                  setActiveHlColor(null);
                  setHlHex("");
                  syncTextBodies();
                  return;
                }
                applyHighlightColor(null);
                setActiveHlColor(null);
                setHlHex("");
              }}
              title="ハイライトを解除"
              className={clearBtnClass}>
              ✕
            </button>
          </div>

          {/* Row 2 — square picker + hex input */}
          <div className="flex items-center gap-1.5 pb-1.5">
            <div
              className={menuSquarePickerClass(!!activeHlColor)}
              style={{ background: activeHlColor ?? "#1a1a2e" }}
              title="クリックでカラーピッカーを開く"
              onClick={() => hlPickerRef.current?.click()}
            >
              <input ref={hlPickerRef} type="color"
                value={activeHlColor ?? "#4c1d95"}
                className="sr-only"
                onChange={(e) => { applyHl(e.target.value, hlOpacity); }}
              />
            </div>
            <HexInput
              value={hlHex}
              onChange={(v) => { setHlHex(v); if (/^[0-9a-fA-F]{6}$/.test(v)) applyHl(`#${v}`, hlOpacity); }}
            />
          </div>

          {/* Row 3 — opacity slider */}
          <OpacityRow
            opacity={hlOpacity}
            disabled={!activeHlColor}
            accentColor={activeHlColor}
            onChange={(op) => {
              setHlOpacity(op);
              if (!activeHlColor) return;
              if (isTextBatch) {
                applyHiliteWholeBodies(textBatchTargetIds, hexToRgba(activeHlColor, op));
                syncTextBodies();
              } else {
                applyHl(activeHlColor, op);
              }
            }}
          />
        </div>

        <RowTintColorPicker
          sectionLabel="ROW TINT"
          value={node.bgColor ?? null}
          onChange={(next, opts) => onSetBgColor(next, { skipHistory: opts?.transient })}
          canClearStored={!!node.bgColor}
          onSliderUndoGestureStart={onMemoColorSliderUndoGestureStart}
          onSliderUndoGestureEnd={onMemoColorSliderUndoGestureEnd}
          className="border-t border-zinc-800/40 pt-0.5"
        />
      </AccordionSection>

      {/* ── DELETE ── */}
      <div className="mt-0.5 border-t border-zinc-800/80 pt-0.5">
        <MenuItem icon="✕" danger onClick={() => { onDelete(); onClose(); }}>
          このノードを削除
        </MenuItem>
      </div>
    </div>
  );
}

// ─── AccordionSection ──────────────────────────────────────────────────────

function AccordionSection({
  sectionId,
  label,
  children,
}: {
  sectionId: string;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => sectionOpenState[sectionId] ?? false);
  const toggle = () =>
    setOpen((prev) => {
      const next = !prev;
      sectionOpenState[sectionId] = next;
      return next;
    });

  return (
    <div className="border-b border-zinc-800/60 last:border-0">
      <button type="button" onClick={toggle}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 transition-all duration-150",
          open
            ? "border-l-2 border-cyan-500/50 bg-cyan-950/15 [box-shadow:inset_2px_0_8px_rgba(6,182,212,0.06)]"
            : "border-l-2 border-transparent hover:border-zinc-700/60 hover:bg-zinc-900/50",
        )}>
        <svg className={cn("h-[7px] w-[7px] shrink-0 transition-all duration-150", open ? "rotate-90 text-cyan-400/80" : "text-zinc-600")}
          viewBox="0 0 8 8" fill="currentColor">
          <polygon points="1,1 7,4 1,7" />
        </svg>
        <span className={cn("text-[9px] tracking-[2px] transition-colors duration-150", open ? "text-cyan-400/80" : "text-zinc-600")}>
          {label}
        </span>
        <div className={cn("h-px flex-1 transition-colors duration-150", open ? "bg-cyan-500/20" : "bg-zinc-800/50")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

// ─── MenuItem ──────────────────────────────────────────────────────────────

interface MenuItemProps {
  icon: string; kbd?: string; active?: boolean;
  disabled?: boolean; danger?: boolean;
  onClick?: () => void; children: ReactNode;
}

function MenuItem({ icon, kbd, active, disabled, danger, onClick, children }: MenuItemProps) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-[5px] text-left font-mono text-[11px] tracking-wide transition-colors",
        disabled ? "cursor-not-allowed text-zinc-600"
          : danger ? "text-red-400/95 hover:bg-zinc-900 hover:text-red-300"
          : active ? "text-cyan-400 hover:bg-zinc-900"
          : "text-zinc-200 hover:bg-zinc-900 hover:text-zinc-50",
      )}>
      <span className="w-3.5 shrink-0 text-center opacity-70">{icon}</span>
      <span className="flex-1">{children}</span>
      {kbd && <span className={cn("shrink-0 text-[9px] tracking-wider text-zinc-600", disabled && "text-zinc-800")}>{kbd}</span>}
    </button>
  );
}

// ─── ToggleSwitch ──────────────────────────────────────────────────────────

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div className={cn("relative h-3 w-6 shrink-0 border", on ? "border-cyan-700 bg-cyan-950/60" : "border-zinc-700 bg-zinc-900")}>
      <div className={cn("absolute top-px h-2 w-2", on ? "left-[calc(100%-9px)] bg-cyan-400" : "left-px bg-zinc-500")} />
    </div>
  );
}

export default NodeContextMenu;
