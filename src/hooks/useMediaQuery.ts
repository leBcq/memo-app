"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Subscribes to a CSS media query (e.g. `(min-width: 768px)` for Tailwind `md`).
 * Initial render uses `false` on the server; updates synchronously on the client.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return matches;
}
