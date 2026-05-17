"use client";

import {
  DISTRIBUTION_STAGES,
  STAGE_COLORS,
  type DistributionStage,
} from "@/types/song";

interface Props {
  stage: DistributionStage;
  releaseDate: string | null;
  onStageChange: (s: DistributionStage) => void;
}

const STAGE_LABELS: Record<DistributionStage, string> = {
  DRAFT: "DRAFT",
  RECORDING: "REC",
  MASTERING: "MASTER",
  SUBMITTED: "SUBMIT",
  LIVE: "LIVE",
};

export function PipelineBlock({ stage, releaseDate, onStageChange }: Props) {
  const currentIdx = DISTRIBUTION_STAGES.indexOf(stage);

  return (
    <div className="flex-1 p-2.5">
      <p className="mb-2 text-[8px] tracking-[3px] text-zinc-700">DISTRIBUTION PIPELINE</p>

      <div className="flex items-center">
        {DISTRIBUTION_STAGES.map((s, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const color = STAGE_COLORS[s];
          return (
            <div key={s} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => onStageChange(s)}
                className="group flex flex-col items-center gap-1"
              >
                <div
                  className="sp-stage-diamond h-2 w-2 border transition-all duration-200"
                  style={{
                    background: isDone || isCurrent ? color : "#0d0d0f",
                    borderColor: isDone || isCurrent ? color : "#2a2a32",
                    boxShadow: isCurrent ? `0 0 0 3px ${color}22` : "none",
                  }}
                />
                <span
                  className="text-[7px] tracking-wider transition-colors"
                  style={{ color: isDone || isCurrent ? color : "#2a2a32" }}
                >
                  {STAGE_LABELS[s]}
                </span>
              </button>
              {i < DISTRIBUTION_STAGES.length - 1 && (
                <div
                  className="mx-0.5 mb-3.5 h-px flex-1 transition-colors duration-200"
                  style={{ background: isDone ? color : "#1a1a20" }}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1.5 text-[9px] tracking-wide text-zinc-800">
        TuneCore 配信予定日 — <span className="text-zinc-700">{releaseDate ?? "未設定"}</span>
      </p>
    </div>
  );
}
