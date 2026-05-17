export type NoteRoot =
  | "C"
  | "C#"
  | "D"
  | "D#"
  | "E"
  | "F"
  | "F#"
  | "G"
  | "G#"
  | "A"
  | "A#"
  | "B";

export type KeyQuality = "maj" | "min";

export type DistributionStage =
  | "DRAFT"
  | "RECORDING"
  | "MASTERING"
  | "SUBMITTED"
  | "LIVE";

export interface SongMeta {
  title: string;
  bpm: number;
  keyRoot: NoteRoot;
  keyQuality: KeyQuality;
  stage: DistributionStage;
  releaseDate: string | null;
  updatedAt: string;
}

export const DEFAULT_SONG_META: SongMeta = {
  title: "",
  bpm: 120,
  keyRoot: "C",
  keyQuality: "maj",
  stage: "DRAFT",
  releaseDate: null,
  updatedAt: new Date().toISOString(),
};

export const DISTRIBUTION_STAGES: DistributionStage[] = [
  "DRAFT",
  "RECORDING",
  "MASTERING",
  "SUBMITTED",
  "LIVE",
];

export const STAGE_COLORS: Record<DistributionStage, string> = {
  DRAFT: "#666666",
  RECORDING: "#f59e0b",
  MASTERING: "#a78bfa",
  SUBMITTED: "#3b82f6",
  LIVE: "#22c55e",
};

export const NOTE_ROOTS: NoteRoot[] = [
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
];
