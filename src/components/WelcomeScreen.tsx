"use client";

type WelcomeScreenProps = {
  onSignIn: () => void;
  /** True while Supabase is resolving the session — hides the sign-in button and shows an ambient indicator. */
  isLoading?: boolean;
};

/** Pre-auth gate — shown instead of the editor until the user signs in. No memo content here. */
export function WelcomeScreen({ onSignIn, isLoading = false }: WelcomeScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-6 font-mono text-zinc-100">
      {/* Ambient grid texture — matches the editor background */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />

      {/* Corner geometry decorations */}
      <div className="pointer-events-none absolute -left-8 top-12 h-40 w-40 rotate-45 border border-cyan-400/20" />
      <div className="pointer-events-none absolute bottom-10 right-12 h-48 w-48 border border-zinc-700/50 opacity-20" />

      {/* Logo + wordmark */}
      <div className="relative flex flex-col items-center gap-5">
        <svg width="36" height="36" viewBox="0 0 28 28" fill="none" className="text-cyan-400">
          <polygon points="14,1 27,14 14,27 1,14" stroke="currentColor" strokeWidth="1.2" />
          <polygon points="14,8 20,14 14,20 8,14" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
        </svg>

        <h1 className="text-2xl font-semibold tracking-[10px] text-zinc-50">FREAVIA</h1>

        <p className="text-[10px] tracking-[3.5px] text-zinc-500">
          A GEOMETRIC OUTLINER FOR CREATORS.
        </p>
      </div>

      {/* CTA / loading indicator */}
      <div className="relative mt-14">
        {isLoading ? (
          <div className="flex items-center gap-3 text-[10px] tracking-[2.5px] text-zinc-600">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-sm bg-cyan-500/50" />
            AUTHENTICATING
          </div>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="border border-zinc-700 px-9 py-2.5 text-[11px] font-medium tracking-[2.5px] text-zinc-300 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 active:scale-[0.98]"
          >
            SIGN IN
          </button>
        )}
      </div>
    </div>
  );
}

export default WelcomeScreen;
