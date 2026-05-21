"use client";

import { useSyncExternalStore } from "react";

/** Space (px) obscured below the visible visual viewport — typically OS keyboard overlap (mobile). */
function getObscuredBottomPx(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", onStoreChange);
  vv.addEventListener("scroll", onStoreChange);
  window.addEventListener("resize", onStoreChange);
  return () => {
    vv.removeEventListener("resize", onStoreChange);
    vv.removeEventListener("scroll", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
  };
}

/**
 * Tracks `visualViewport` so fixed UI can sit flush above the on-screen keyboard.
 */
export function useVisualViewportBottomInsetPx(): number {
  return useSyncExternalStore(subscribe, getObscuredBottomPx, () => 0);
}
