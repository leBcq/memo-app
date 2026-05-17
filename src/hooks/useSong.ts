import { useState, useCallback, useEffect, useRef } from "react";
import type {
  SongMeta,
  NoteRoot,
  KeyQuality,
  DistributionStage,
} from "@/types/song";
import { DEFAULT_SONG_META } from "@/types/song";
import { clampBpm } from "@/types/memoKind";

const STORAGE_KEY = "geo-memo-song-meta";

function load(): SongMeta {
  if (typeof window === "undefined") return DEFAULT_SONG_META;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SONG_META;
    return { ...DEFAULT_SONG_META, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SONG_META;
  }
}

export function useSong() {
  // Always start with defaults so SSR and initial CSR match.
  const [song, setSong] = useState<SongMeta>(DEFAULT_SONG_META);
  const [isHydrated, setIsHydrated] = useState(false);
  // Stable ref prevents stale-closure warnings without extra deps.
  const songRef = useRef(song);
  songRef.current = song;

  // Load from localStorage after mount (never runs on server).
  useEffect(() => {
    setSong(load());
    setIsHydrated(true);
  }, []);

  // Save to localStorage only after hydration to avoid overwriting with defaults.
  useEffect(() => {
    if (!isHydrated) return;
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songRef.current));
    }, 300);
    return () => clearTimeout(id);
  }, [song, isHydrated]);

  const update = useCallback(
    <K extends keyof SongMeta>(key: K, value: SongMeta[K]) => {
      setSong((prev) => ({
        ...prev,
        [key]: value,
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const setTitle = useCallback((v: string) => update("title", v), [update]);
  const setBpm = useCallback((v: number) => update("bpm", clampBpm(v)), [update]);
  const setKeyRoot = useCallback((v: NoteRoot) => update("keyRoot", v), [update]);
  const setKeyQuality = useCallback(
    (v: KeyQuality) => update("keyQuality", v),
    [update],
  );
  const setStage = useCallback(
    (v: DistributionStage) => update("stage", v),
    [update],
  );
  const setReleaseDate = useCallback(
    (v: string | null) => update("releaseDate", v),
    [update],
  );

  return { song, setTitle, setBpm, setKeyRoot, setKeyQuality, setStage, setReleaseDate };
}
