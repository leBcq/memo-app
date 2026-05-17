import { useRef, useCallback } from "react";
import { clampBpm } from "@/types/memoKind";

const MAX_TAPS = 8;
const TAP_TIMEOUT_MS = 2000;

export function useTapTempo(onBpmChange: (bpm: number) => void) {
  const tapsRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tap = useCallback(() => {
    const now = Date.now();
    tapsRef.current.push(now);
    if (tapsRef.current.length > MAX_TAPS) tapsRef.current.shift();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      tapsRef.current = [];
    }, TAP_TIMEOUT_MS);

    if (tapsRef.current.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < tapsRef.current.length; i += 1) {
        diffs.push(tapsRef.current[i] - tapsRef.current[i - 1]);
      }
      const avgInterval = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const bpm = Math.round(60000 / avgInterval);
      onBpmChange(clampBpm(bpm));
    }
  }, [onBpmChange]);

  const reset = useCallback(() => {
    tapsRef.current = [];
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { tap, reset };
}
