"use client";

import { NOTE_ROOTS, type NoteRoot, type KeyQuality } from "@/types/song";
import { cn } from "@/lib/utils";

interface Props {
  keyRoot: NoteRoot;
  keyQuality: KeyQuality;
  onRootChange: (r: NoteRoot) => void;
  onQualityChange: (q: KeyQuality) => void;
}

export function KeyBlock({ keyRoot, keyQuality, onRootChange, onQualityChange }: Props) {
  return (
    <div className="border-r border-zinc-900 p-2.5">
      <p className="mb-1.5 text-[8px] tracking-[3px] text-zinc-700">KEY</p>

      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="font-mono text-[28px] leading-none text-zinc-100">{keyRoot}</span>
        <button
          type="button"
          onClick={() => onQualityChange(keyQuality === "maj" ? "min" : "maj")}
          className={cn(
            "border px-1.5 py-0.5 font-mono text-[11px] tracking-wider transition-colors",
            keyQuality === "min"
              ? "border-violet-700 text-violet-400"
              : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400",
          )}
        >
          {keyQuality}
        </button>
      </div>

      <div className="flex flex-wrap gap-[3px]">
        {NOTE_ROOTS.map((root) => (
          <button
            key={root}
            type="button"
            onClick={() => onRootChange(root)}
            className={cn(
              "min-w-[24px] border px-1 py-0.5 text-center font-mono text-[9px] transition-colors",
              root === keyRoot
                ? "sp-root-active border-cyan-700 bg-cyan-950/30 text-cyan-400"
                : "border-zinc-800 text-zinc-600 hover:border-zinc-600 hover:text-zinc-400",
            )}
          >
            {root}
          </button>
        ))}
      </div>
    </div>
  );
}
