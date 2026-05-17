/** Game-dev memo pipeline (preparation for future use). */

export type GamedevStage = "PLANNING" | "IMPLEMENTING" | "DEBUGGING" | "RELEASED";

export const GAMEDEV_STAGES: GamedevStage[] = [
  "PLANNING",
  "IMPLEMENTING",
  "DEBUGGING",
  "RELEASED",
];

export const GAMEDEV_STAGE_COLORS: Record<GamedevStage, string> = {
  PLANNING: "#a78bfa",
  IMPLEMENTING: "#3b82f6",
  DEBUGGING: "#f59e0b",
  RELEASED: "#22c55e",
};

export function normalizeGamedevStage(raw: unknown): GamedevStage {
  if (
    raw === "PLANNING" ||
    raw === "IMPLEMENTING" ||
    raw === "DEBUGGING" ||
    raw === "RELEASED"
  ) {
    return raw;
  }
  return "PLANNING";
}
