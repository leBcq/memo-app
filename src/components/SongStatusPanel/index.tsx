"use client";

import { useRef } from "react";
import { useSong } from "@/hooks/useSong";
import { BpmBlock } from "@/components/SongStatusPanel/BpmBlock";
import { KeyBlock } from "@/components/SongStatusPanel/KeyBlock";
import { PipelineBlock } from "@/components/SongStatusPanel/PipelineBlock";
import { STAGE_COLORS } from "@/types/song";
import "@/components/SongStatusPanel/panel.css";

const STAGE_LABELS_LONG: Record<string, string> = {
  DRAFT: "DRAFT",
  RECORDING: "RECORDING",
  MASTERING: "MASTERING",
  SUBMITTED: "SUBMITTED",
  LIVE: "LIVE",
};

export function SongStatusPanel() {
  const { song, setTitle, setBpm, setKeyRoot, setKeyQuality, setStage } = useSong();
  const titleRef = useRef<HTMLInputElement>(null);
  const badgeColor = STAGE_COLORS[song.stage];

  return (
    <div className="sp-frame shrink-0">
      <div className="sp-corner sp-corner-tl" />
      <div className="sp-corner sp-corner-tr" />
      <div className="sp-corner sp-corner-bl" />
      <div className="sp-corner sp-corner-br" />

      <div className="flex h-9 items-center border-b border-zinc-900">
        <div className="flex h-full flex-shrink-0 items-center gap-2 border-r border-zinc-900 px-3">
          <div className="sp-sys-diamond" aria-hidden="true" />
          <span className="text-[9px] tracking-[3px] text-cyan-500/60">TRACK</span>
        </div>

        <input
          ref={titleRef}
          type="text"
          value={song.title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="UNTITLED TRACK"
          spellCheck={false}
          className="h-full flex-1 border-none bg-transparent px-3.5 font-mono text-sm font-medium tracking-wide text-zinc-200 outline-none placeholder:text-zinc-800"
        />

        <div className="flex h-full items-center border-l border-zinc-900 px-3">
          <div
            className="sp-badge border px-2 py-0.5 font-mono text-[9px] tracking-[2px]"
            style={{ color: badgeColor, borderColor: badgeColor }}
          >
            {STAGE_LABELS_LONG[song.stage]}
          </div>
        </div>
      </div>

      <div className="flex">
        <BpmBlock bpm={song.bpm} onBpmChange={setBpm} />
        <KeyBlock
          keyRoot={song.keyRoot}
          keyQuality={song.keyQuality}
          onRootChange={setKeyRoot}
          onQualityChange={setKeyQuality}
        />
        <PipelineBlock
          stage={song.stage}
          releaseDate={song.releaseDate}
          onStageChange={setStage}
        />
      </div>

      <div className="flex h-5 items-center gap-3 border-t border-zinc-900 px-3">
        <span className="text-[8px] tracking-[2px] text-zinc-800">
          Freavia <span className="text-zinc-700">DTM MODE</span>
        </span>
        <div className="sp-stage-diamond h-[3px] w-[3px] bg-zinc-800" aria-hidden="true" />
        <span className="text-[8px] tracking-[1.5px] text-zinc-700">
          KEY <span className="text-zinc-600">{song.keyRoot} {song.keyQuality}</span>
        </span>
        <div className="sp-stage-diamond h-[3px] w-[3px] bg-zinc-800" aria-hidden="true" />
        <span className="text-[8px] tracking-[1.5px] text-zinc-700">
          BPM <span className="text-zinc-600">{song.bpm}</span>
        </span>
      </div>
    </div>
  );
}
