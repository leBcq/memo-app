"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [note, setNote] = useState("…");

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setNote("");
        router.replace("/");
        return;
      }
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          setNote(error.message);
          router.replace("/");
          return;
        }
      }
      router.replace("/");
    };
    void run();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 bg-zinc-950 font-mono text-[11px] text-zinc-500">
      <p className="tracking-[0.2em] text-cyan-500/80">FREAVIA</p>
      <p>{note}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-zinc-950 font-mono text-[11px] text-zinc-500">
          …
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
