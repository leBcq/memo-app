"use client";

import { cn } from "@/lib/utils";

export function menuSwatchClass(active: boolean) {
  return cn(
    "h-5 w-5 shrink-0 rounded-full border p-0 leading-none transition-all duration-100 hover:scale-110",
    active
      ? "border-white/60 ring-1 ring-white/30 ring-offset-1 ring-offset-zinc-950 scale-105"
      : "border-white/15 hover:border-white/35",
  );
}

export function menuSquarePickerClass(hasColor: boolean) {
  return cn(
    "relative h-5 w-5 shrink-0 cursor-pointer border transition-colors hover:border-zinc-400",
    hasColor ? "border-zinc-500" : "border-zinc-700",
  );
}

export function HexInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-5 flex-1 items-center gap-1 border border-zinc-800 bg-zinc-900 px-1.5">
      <span className="text-[10px] text-zinc-600">#</span>
      <input
        type="text"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9a-fA-F]/g, ""))}
        className="w-full bg-transparent font-mono text-[10px] text-zinc-200 outline-none"
        placeholder="rrggbb"
      />
    </div>
  );
}

export function OpacityRow({
  opacity,
  disabled,
  accentColor,
  onChange,
  sliderUndoGesture,
}: {
  opacity: number;
  disabled: boolean;
  accentColor: string | null;
  onChange: (op: number) => void;
  /** Range slider: live updates without history; pointer-up runs `onEnd`. */
  sliderUndoGesture?: {
    onStart: () => void;
    onEnd: () => void;
    onLiveChange: (op: number) => void;
  };
}) {
  const attachRangePointerUp = () => {
    const up = () => {
      sliderUndoGesture?.onEnd();
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 shrink-0 text-center text-[9px] tracking-widest text-zinc-600">A</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={opacity}
        disabled={disabled}
        onPointerDown={(e) => {
          if (!sliderUndoGesture || disabled || e.button !== 0) return;
          sliderUndoGesture.onStart();
          attachRangePointerUp();
        }}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (sliderUndoGesture) sliderUndoGesture.onLiveChange(v);
          else onChange(v);
        }}
        className="h-[3px] flex-1 cursor-pointer appearance-none rounded-none bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-500 [&::-webkit-slider-thumb]:bg-zinc-300"
        style={{ accentColor: accentColor || "#6b7280" }}
      />
      <div
        className={cn(
          "flex h-5 w-9 shrink-0 items-center border border-zinc-700 bg-zinc-900",
          disabled && "opacity-30",
        )}
      >
        <input
          type="number"
          min={0}
          max={100}
          value={opacity}
          disabled={disabled}
          onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          className="w-full bg-transparent text-center font-mono text-[10px] text-zinc-200 outline-none disabled:cursor-not-allowed"
        />
      </div>
      <span className="shrink-0 text-[9px] text-zinc-600">%</span>
    </div>
  );
}
