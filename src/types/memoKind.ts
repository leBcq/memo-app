import type { GamedevStage } from "@/types/gamedev";
import type { DistributionStage } from "@/types/song";

export type MemoType = "standard" | "music" | "gamedev";

/** Production → release pipeline for music memos (independent of memo workflow DRAFT/WIP/DONE). */
export type MusicReleaseStatus =
  | "IDEA"
  | "DEMO"
  | "RECORDING"
  | "MIXING"
  | "MASTERING"
  | "SUBMITTED"
  | "LIVE";

export const MUSIC_RELEASE_PROGRESS_STAGES: MusicReleaseStatus[] = [
  "IDEA",
  "DEMO",
  "RECORDING",
  "MIXING",
  "MASTERING",
  "SUBMITTED",
  "LIVE",
];

export const MUSIC_RELEASE_PROGRESS_COLORS: Record<MusicReleaseStatus, string> = {
  IDEA: "#71717a",
  DEMO: "#94a3b8",
  RECORDING: "#f59e0b",
  MIXING: "#fb923c",
  MASTERING: "#a78bfa",
  SUBMITTED: "#3b82f6",
  LIVE: "#22c55e",
};

const LEGACY_DISTRIBUTION_TO_RELEASE: Partial<Record<DistributionStage, MusicReleaseStatus>> = {
  DRAFT: "IDEA",
  RECORDING: "RECORDING",
  MASTERING: "MASTERING",
  SUBMITTED: "SUBMITTED",
  LIVE: "LIVE",
};

/** Music-only fields persisted on each music memo. */
export type MemoMusicMeta = {
  bpm: number;
  /** Pitch class, e.g. C, C#, D */
  key: string;
  /** "major" | "minor" (aliases maj/min accepted when loading) */
  scale: string;
  musicReleaseStatus: MusicReleaseStatus;
};

/** Game-dev–only fields persisted on each gamedev memo. */
export type MemoGamedevMeta = {
  stage: GamedevStage;
};

export const DEFAULT_GAMEDEV_META: MemoGamedevMeta = {
  stage: "PLANNING",
};

export const DEFAULT_MUSIC_META: MemoMusicMeta = {
  bpm: 120,
  key: "C",
  scale: "major",
  musicReleaseStatus: "IDEA",
};

const BPM_MIN = 20;
const BPM_MAX = 999;

export function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MUSIC_META.bpm;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(n)));
}

function coerceStoredBpm(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return clampBpm(raw);
  if (typeof raw === "string") {
    const n = parseInt(raw.replace(/\D/g, "").slice(0, 3), 10);
    if (!Number.isNaN(n)) return clampBpm(n);
  }
  return DEFAULT_MUSIC_META.bpm;
}

export function normalizeMusicReleaseStatus(
  raw: unknown,
  legacyStageField?: unknown,
): MusicReleaseStatus {
  if (
    typeof raw === "string" &&
    (MUSIC_RELEASE_PROGRESS_STAGES as readonly string[]).includes(raw)
  ) {
    return raw as MusicReleaseStatus;
  }
  if (legacyStageField !== undefined) {
    const d = normalizeDistributionStage(legacyStageField);
    const mapped = LEGACY_DISTRIBUTION_TO_RELEASE[d];
    if (mapped) return mapped;
  }
  return "IDEA";
}

const NOTE_SET = new Set([
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
]);

export function normalizeMusicKey(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_MUSIC_META.key;
  const t = raw.trim();
  if (NOTE_SET.has(t)) return t;
  return DEFAULT_MUSIC_META.key;
}

export function normalizeMusicScale(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_MUSIC_META.scale;
  const s = raw.trim().toLowerCase();
  if (s === "maj" || s === "major") return "major";
  if (s === "min" || s === "minor") return "minor";
  return DEFAULT_MUSIC_META.scale;
}

export function scaleToKeyQuality(scale: string): "maj" | "min" {
  return normalizeMusicScale(scale) === "minor" ? "min" : "maj";
}

export function keyQualityToScale(q: "maj" | "min"): "major" | "minor" {
  return q === "min" ? "minor" : "major";
}

const STAGES: DistributionStage[] = [
  "DRAFT",
  "RECORDING",
  "MASTERING",
  "SUBMITTED",
  "LIVE",
];

export function normalizeDistributionStage(raw: unknown): DistributionStage {
  if (typeof raw === "string" && STAGES.includes(raw as DistributionStage)) {
    return raw as DistributionStage;
  }
  return "DRAFT";
}

export function normalizeMemoType(raw: unknown): MemoType {
  if (raw === "music" || raw === "gamedev" || raw === "standard") return raw;
  return "standard";
}

/** Coerce persisted music memo meta (migrates legacy `stage` distribution field). */
export function normalizeMusicMeta(raw: unknown): MemoMusicMeta {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MUSIC_META };
  const r = raw as Record<string, unknown>;
  return {
    bpm: coerceStoredBpm(r.bpm),
    key: normalizeMusicKey(r.key),
    scale: normalizeMusicScale(r.scale),
    musicReleaseStatus: normalizeMusicReleaseStatus(r.musicReleaseStatus, r.stage),
  };
}
