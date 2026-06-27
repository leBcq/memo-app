"use client";

import { cn } from "@/lib/utils";

export type CloudSyncPhase = "idle" | "loading" | "saving" | "saved" | "error";

type Props = {
  phase: CloudSyncPhase;
  message?: string;
  remoteEnabled: boolean;
};

/**
 * Minimal cyber status chip — fixed bottom-left, does not affect layout flow.
 */
export function CloudSyncIndicator({ phase, message, remoteEnabled }: Props) {
  if (phase === "idle") return null;
  // Show all phases when remote is enabled; show only the "saved" flash for local-only mode
  if (!remoteEnabled && phase !== "saved") return null;

  const label =
    phase === "loading"
      ? "SYNC ►"
      : phase === "saving"
        ? "SAVE ···"
        : phase === "saved"
          ? remoteEnabled ? "OK" : "SAVED"
          : phase === "error"
            ? "ERR"
            : "···";

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-[60] select-none font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/55"
      aria-live="polite"
    >
      <div
        className={cn(
          "flex items-center gap-2 border border-cyan-500/25 bg-zinc-950/85 px-2 py-1 shadow-[0_0_12px_rgba(34,211,238,0.08)] backdrop-blur-sm",
          phase === "error" && "border-rose-500/35 text-rose-300/75",
          phase === "saved" && "border-emerald-500/25 text-emerald-300/60",
        )}
      >
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-[1px] bg-cyan-400/80 shadow-[0_0_6px_rgba(34,211,238,0.5)]",
            phase === "loading" && "animate-pulse",
            phase === "saving" && "scale-110 animate-pulse",
            phase === "saved" && "bg-emerald-400/90 shadow-[0_0_6px_rgba(52,211,153,0.45)]",
            phase === "error" && "bg-rose-400/90 shadow-[0_0_6px_rgba(251,113,133,0.4)]",
          )}
          aria-hidden
        />
        <span className="tabular-nums">{label}</span>
        {message && phase === "error" && (
          <span className="max-w-[14rem] truncate normal-case tracking-normal text-[9px] text-rose-200/70">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
