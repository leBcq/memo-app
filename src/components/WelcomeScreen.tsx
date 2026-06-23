"use client";

type WelcomeScreenProps = {
  onSignIn: () => void;
};

/** Pre-auth gate — shown instead of the editor until the user signs in. No memo content here. */
export function WelcomeScreen({ onSignIn }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 font-mono text-zinc-100">
      <div className="flex flex-col items-center gap-4">
        <svg width="30" height="30" viewBox="0 0 28 28" fill="none" className="text-cyan-400">
          <polygon points="14,1 27,14 14,27 1,14" stroke="currentColor" strokeWidth="1.3" />
          <polygon points="14,8 20,14 14,20 8,14" stroke="currentColor" strokeWidth="1" opacity="0.55" />
        </svg>
        <h1 className="text-2xl font-semibold tracking-[8px] text-zinc-50">FREAVIA</h1>
        <p className="text-[11px] tracking-[3px] text-zinc-500">
          A GEOMETRIC OUTLINER FOR CREATORS.
        </p>
      </div>

      <button
        type="button"
        onClick={onSignIn}
        className="mt-14 border border-zinc-700 px-9 py-2.5 text-[11px] font-medium tracking-[2px] text-zinc-200 transition-colors hover:border-cyan-500/70 hover:text-cyan-300"
      >
        SIGN IN
      </button>
    </div>
  );
}

export default WelcomeScreen;
