"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// ── Parser ─────────────────────────────────────────────────────────────────

// Supports half-width colon `:` (U+003A) and full-width colon `：` (U+FF1A) as separators.
const GLOSSARY_RE = /\[\[([^\]：:]+)[：:]([^\]]+)\]\]/g;

/** Returns true if html contains at least one [[word:def]] or [[word：def]] pattern. */
export function hasGlossaryPattern(html: string): boolean {
  GLOSSARY_RE.lastIndex = 0;
  return GLOSSARY_RE.test(html);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Replaces [[word:def]] / [[word：def]] in HTML with decorated <span> elements.
 * The regex is safe here because [[ ]] cannot appear inside valid HTML tag syntax.
 */
export function buildGlossaryHtml(html: string): string {
  GLOSSARY_RE.lastIndex = 0;
  return html.replace(GLOSSARY_RE, (_, word: string, def: string) => {
    return `<span class="geo-glossary" data-def="${escapeAttr(def.trim())}" tabindex="-1">${word.trim()}</span>`;
  });
}

// ── Tooltip ────────────────────────────────────────────────────────────────

type TooltipProps = {
  word: string;
  def: string;
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

function GlossaryTooltip({ word, def, anchorRect, onMouseEnter, onMouseLeave }: TooltipProps) {
  const left = anchorRect.left + anchorRect.width / 2;
  const top = anchorRect.top - 6;

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        transform: "translate(-50%, -100%)",
        zIndex: 9999,
        maxWidth: "min(320px, 88vw)",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "pointer-events-auto select-text",
        "rounded border border-zinc-700/60 bg-neutral-900/95 px-3.5 py-2.5",
        "shadow-[0_12px_40px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)]",
        "backdrop-blur-md",
      )}
    >
      {/* Arrow tip */}
      <div
        className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-zinc-700/60"
        aria-hidden
      />
      <p className="mb-1 font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-cyan-400/90">
        {word}
      </p>
      <p className="font-mono text-[11px] leading-relaxed text-zinc-300/85 whitespace-pre-wrap">
        {def}
      </p>
    </div>
  );
}

// ── Overlay component ───────────────────────────────────────────────────────

type TooltipState = {
  word: string;
  def: string;
  anchorRect: DOMRect;
} | null;

type Props = {
  html: string;
  className?: string;
  style?: React.CSSProperties;
  /** Called when the user clicks outside a glossary term (enters edit mode). */
  onClickToEdit: () => void;
};

export function GlossaryOverlay({ html, className, style, onClickToEdit }: Props) {
  const processedHtml = useMemo(() => buildGlossaryHtml(html), [html]);
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => setTooltip(null), 180);
  }, [cancelHide]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const term = (e.target as HTMLElement).closest<HTMLElement>(".geo-glossary");
      if (!term) {
        scheduleHide();
        return;
      }
      cancelHide();
      const word = term.textContent ?? "";
      const def = term.getAttribute("data-def") ?? "";
      const anchorRect = term.getBoundingClientRect();
      setTooltip((prev) =>
        prev?.word === word && prev?.def === def ? prev : { word, def, anchorRect },
      );
    },
    [cancelHide, scheduleHide],
  );

  const handlePointerLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  return (
    <>
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={(e) => {
          // Clicking a glossary term shows/keeps tooltip — don't enter edit mode
          if ((e.target as HTMLElement).closest(".geo-glossary")) return;
          onClickToEdit();
        }}
        onDoubleClick={onClickToEdit}
      />
      {tooltip &&
        createPortal(
          <GlossaryTooltip
            word={tooltip.word}
            def={tooltip.def}
            anchorRect={tooltip.anchorRect}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
          />,
          document.body,
        )}
    </>
  );
}
