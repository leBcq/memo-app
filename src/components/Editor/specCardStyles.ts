import { cn } from "@/lib/utils";

/** Shared label row for plugin / game spec cards. */
export const SPEC_CARD_LABEL_CLASS =
  "mb-0.5 block text-[8px] font-mono tracking-[2px] text-zinc-600";

type SpecCardOuterOpts = {
  /**
   * When false (row tint alpha ~0), drop gamedev’s decorative amber border/glow so no “ghost” frame remains.
   * Music cards ignore this (already neutral zinc).
   */
  themedChrome?: boolean;
};

/** Outer chrome: music (neutral) vs gamedev (amber cyber accent, skippable when theme alpha is off). */
export function specCardOuterClass(variant: "music" | "gamedev", opts?: SpecCardOuterOpts) {
  const themed = opts?.themedChrome !== false;
  const neutral = cn(
    "min-h-[22px] flex-1 rounded-md border border-zinc-700/55 bg-zinc-800/50 px-2.5 py-2",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  );
  if (variant === "gamedev" && themed) {
    return cn(
      "min-h-[22px] flex-1 rounded-md border border-amber-500/20 bg-zinc-900/40 px-2.5 py-2",
      "shadow-[inset_0_1px_0_rgba(251,191,36,0.06),0_0_24px_rgba(251,191,36,0.04)]",
    );
  }
  return neutral;
}