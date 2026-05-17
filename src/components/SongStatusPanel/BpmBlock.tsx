"use client";

import { useRef } from "react";
import { useTapTempo } from "@/hooks/useTapTempo";
import { cn } from "@/lib/utils";

interface Props {
  bpm: number;
  onBpmChange: (bpm: number) => void;
}

export function BpmBlock({ bpm, onBpmChange }: Props) {
  const editRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const { tap, reset } = useTapTempo(onBpmChange);

  const handleBlur = () => {
    const val = parseInt(editRef.current?.textContent ?? "", 10);
    if (!Number.isNaN(val)) onBpmChange(val);
    else if (editRef.current) editRef.current.textContent = String(bpm);
  };

  return (
    <div className="border-r border-zinc-900 p-2.5">
      <p className="mb-1.5 text-[8px] tracking-[3px] text-zinc-700">BPM</p>

      <div className="mb-2 flex items-baseline gap-2">
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          className="sp-bpm-edit cursor-text font-mono text-3xl leading-none text-zinc-100"
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (isComposingRef.current) return;
            if (e.key === "Enter") {
              e.preventDefault();
              editRef.current?.blur();
            }
          }}
        >
          {bpm}
        </div>
        <span className="text-[9px] tracking-wider text-zinc-700">BPM</span>
      </div>

      <div className="flex gap-1">
        {[
          { label: "−", onClick: () => onBpmChange(bpm - 1) },
          { label: "＋", onClick: () => onBpmChange(bpm + 1) },
          { label: "TAP", onClick: tap },
          { label: "RST", onClick: reset, danger: true },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            className={cn(
              "border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-zinc-600 transition-colors",
              btn.danger
                ? "hover:border-red-900 hover:text-red-600"
                : "hover:border-cyan-800 hover:text-cyan-400",
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
