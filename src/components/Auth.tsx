"use client";

import { LogIn, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Sidebar footer: Google OAuth + session (Supabase). */
export function SidebarAuthBar() {
  const { t } = useTranslation();
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      closeMenu();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen, closeMenu]);

  if (!configured) {
    return (
      <p className="px-2 py-1.5 text-center font-mono text-[9px] leading-snug tracking-wide text-zinc-600">
        {t("auth.notConfigured")}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="px-2 py-2 text-center font-mono text-[9px] tracking-[0.2em] text-zinc-500">
        {t("auth.loading")}
      </div>
    );
  }

  if (user) {
    const name =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email ??
      t("auth.userFallback");
    const avatar =
      typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;

    return (
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "flex min-h-[44px] w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors md:min-h-0 md:p-1.5",
            "border-zinc-700/50 bg-zinc-900/60 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.06)]",
            menuOpen
              ? "border-cyan-500/45 bg-zinc-900/90 ring-1 ring-cyan-500/25"
              : "hover:border-cyan-500/35 hover:bg-zinc-900/75",
          )}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="h-8 w-8 shrink-0 rounded-sm border border-cyan-500/25 object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-cyan-500/30 bg-zinc-950 font-mono text-[10px] text-cyan-400/90"
              aria-hidden
            >
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] tracking-wide text-zinc-200">{name}</p>
            <p className="mt-0.5 font-mono text-[8px] tracking-[0.15em] text-zinc-600">
              {t("auth.accountMenuHint")}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] text-zinc-500 transition-transform",
              menuOpen && "-rotate-90 text-cyan-400/80",
            )}
            aria-hidden
          >
            ›
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className={cn(
              "absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-md border border-zinc-700/80 bg-zinc-950 py-0.5 font-mono",
              "shadow-[0_-8px_28px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(6,182,212,0.09)]",
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
        <button
          type="button"
          role="menuitem"
          className="flex min-h-[44px] w-full items-center gap-2 px-3 py-3 text-left text-[12px] font-mono tracking-wide text-zinc-300 transition-colors hover:bg-fuchsia-950/35 hover:text-fuchsia-200 md:min-h-0 md:px-2.5 md:py-2 md:text-[10px]"
              onClick={() => {
                closeMenu();
                void signOut();
              }}
            >
              <LogOut size={12} strokeWidth={2} className="shrink-0 opacity-80" />
              {t("auth.signOut")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle()}
      className={cn(
        "group flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 md:min-h-0 md:px-2.5 md:py-2",
        "border-cyan-500/35 bg-zinc-950/80 font-mono text-[12px] tracking-[0.12em] text-cyan-100/95 md:text-[10px]",
        "shadow-[inset_0_0_0_1px_rgba(6,182,212,0.08),0_0_20px_rgba(6,182,212,0.04)]",
        "transition-colors duration-150",
        "hover:border-fuchsia-400/45 hover:bg-cyan-950/25 hover:text-fuchsia-100/95 hover:shadow-[inset_0_0_0_1px_rgba(192,38,211,0.15)]",
        "active:scale-[0.99]",
      )}
    >
      <GoogleGlyph className="h-3.5 w-3.5 shrink-0 opacity-90 transition-opacity group-hover:opacity-100" />
      <LogIn size={12} strokeWidth={2} className="shrink-0 opacity-70 group-hover:opacity-90" />
      <span>{t("auth.signInGoogle")}</span>
    </button>
  );
}
