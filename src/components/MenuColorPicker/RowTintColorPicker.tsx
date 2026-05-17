"use client";

import { useEffect, useRef, useState } from "react";
import { MENU_COLOR_PRESETS, hexToRgba, parseStoredColor } from "@/lib/menuColorUtils";
import { HexInput, OpacityRow, menuSquarePickerClass, menuSwatchClass } from "./primitives";

type Props = {
  /** rgba / #RRGGBB / #RRGGBBAA or null when cleared */
  value: string | null;
  onChange: (next: string | null, opts?: { transient?: boolean }) => void;
  /** Section caption (e.g. ROW TINT, LABEL) */
  sectionLabel: string;
  className?: string;
  /** True when storage still has a color but `value` did not parse (e.g. legacy string). */
  canClearStored?: boolean;
  /** When both are set, opacity range uses transient `onChange` + one undo step on release. */
  onSliderUndoGestureStart?: () => void;
  onSliderUndoGestureEnd?: () => void;
};

/**
 * STYLE ▸ ROW TINT block — reused for sidebar label colors.
 */
export function RowTintColorPicker({
  value,
  onChange,
  sectionLabel,
  className,
  canClearStored,
  onSliderUndoGestureStart,
  onSliderUndoGestureEnd,
}: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const init = parseStoredColor(value);
  const [rowTintHex, setRowTintHex] = useState(init?.hex ?? "");
  const [rowTintInputHex, setRowTintInputHex] = useState((init?.hex ?? "").replace("#", ""));
  const [rowTintOpacity, setRowTintOpacity] = useState(init?.opacity ?? 40);

  useEffect(() => {
    const p = parseStoredColor(value);
    setRowTintHex(p?.hex ?? "");
    setRowTintInputHex((p?.hex ?? "").replace("#", ""));
    setRowTintOpacity(p?.opacity ?? 40);
  }, [value]);

  const applyTint = (hex: string, opacity: number, opts?: { transient?: boolean }) => {
    setRowTintHex(hex);
    setRowTintInputHex(hex.replace("#", ""));
    onChange(hexToRgba(hex, opacity), { transient: opts?.transient });
  };

  const finishGestureAndApply = (hex: string, opacity: number) => {
    onSliderUndoGestureEnd?.();
    applyTint(hex, opacity, { transient: false });
  };

  const hasTint = !!rowTintHex;
  const clearEnabled = !!(rowTintHex || value || canClearStored);
  const hasUndoSlider = !!(onSliderUndoGestureStart && onSliderUndoGestureEnd);

  return (
    <div className={className} onMouseDown={(e) => e.stopPropagation()}>
      <div className="px-3 pb-2">
        <div className="mb-1.5 text-[9px] tracking-[2px] text-zinc-600">{sectionLabel}</div>

        <div className="flex flex-wrap items-center gap-2 pb-1.5">
          {MENU_COLOR_PRESETS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                finishGestureAndApply(swatch, rowTintOpacity);
              }}
              title={swatch}
              className={menuSwatchClass(rowTintHex === swatch)}
              style={{ background: swatch }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 pb-1.5">
          <div
            className={menuSquarePickerClass(hasTint)}
            style={{ background: rowTintHex || "#1a1a2e" }}
            title="クリックでカラーピッカーを開く"
            onClick={() => pickerRef.current?.click()}
          >
            <input
              ref={pickerRef}
              type="color"
              value={rowTintHex || "#3b1d6e"}
              className="sr-only"
              onChange={(e) => {
                finishGestureAndApply(e.target.value, rowTintOpacity);
              }}
            />
          </div>
          <HexInput
            value={rowTintInputHex}
            onChange={(v) => {
              setRowTintInputHex(v);
              if (/^[0-9a-fA-F]{6}$/.test(v)) finishGestureAndApply(`#${v}`, rowTintOpacity);
            }}
          />
        </div>

        <OpacityRow
          opacity={rowTintOpacity}
          disabled={!rowTintHex}
          accentColor={rowTintHex || null}
          onChange={(op) => {
            setRowTintOpacity(op);
            if (rowTintHex) finishGestureAndApply(rowTintHex, op);
          }}
          sliderUndoGesture={
            hasUndoSlider && rowTintHex
              ? {
                  onStart: onSliderUndoGestureStart,
                  onEnd: onSliderUndoGestureEnd,
                  onLiveChange: (op) => {
                    setRowTintOpacity(op);
                    applyTint(rowTintHex, op, { transient: true });
                  },
                }
              : undefined
          }
        />

        <button
          type="button"
          disabled={!clearEnabled}
          onClick={(e) => {
            e.stopPropagation();
            onSliderUndoGestureEnd?.();
            onChange(null);
            setRowTintHex("");
            setRowTintInputHex("");
            setRowTintOpacity(40);
          }}
          className="mt-2 flex w-full items-center justify-center gap-1 border border-zinc-800/80 bg-zinc-900/40 py-1 font-mono text-[10px] tracking-wide text-zinc-500 transition-colors hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>×</span>
          このカラーを削除
        </button>
      </div>
    </div>
  );
}
