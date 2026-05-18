import type { SupabaseClient } from "@supabase/supabase-js";

function logPostgrestError(context: string, err: unknown) {
  if (err !== null && typeof err === "object") {
    const o = err as Record<string, unknown>;
    console.error(context, {
      ...o,
      code: o.code,
      message: o.message,
      details: o.details,
      hint: o.hint,
    });
    return;
  }
  console.error(context, err);
}

export type MemoShareRole = "viewer" | "editor";

export type MemoShareRow = {
  id: string;
  memo_id: string;
  shared_with_email: string;
  role: MemoShareRole;
  created_at: string;
};

/** Match storage + RLS: lowercase, trimmed */
export function normalizeShareEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** For the signed-in invitee: memo_id → role (from `memo_shares` visible via RLS). */
export async function fetchInviteeShareRolesByMemoId(
  client: SupabaseClient,
  email: string | null | undefined,
): Promise<Map<string, MemoShareRole>> {
  const map = new Map<string, MemoShareRole>();
  if (email == null || typeof email !== "string" || email.trim() === "") return map;
  const norm = normalizeShareEmail(email);
  const { data, error } = await client
    .from("memo_shares")
    .select("memo_id, role")
    .eq("shared_with_email", norm);
  if (error) throw error;
  for (const row of data ?? []) {
    const mid = row.memo_id as string;
    const role = row.role as MemoShareRole;
    if (role === "viewer" || role === "editor") map.set(mid, role);
  }
  return map;
}

export async function fetchShares(client: SupabaseClient, memoId: string): Promise<MemoShareRow[]> {
  if (memoId == null || typeof memoId !== "string" || memoId.trim() === "") {
    const err = new Error("[fetchShares] memoId is missing or invalid");
    console.error(err.message, { memoId });
    throw err;
  }

  const { data, error } = await client
    .from("memo_shares")
    .select("id,memo_id,shared_with_email,role,created_at")
    .eq("memo_id", memoId.trim())
    .order("created_at", { ascending: true });

  if (error) {
    logPostgrestError("[fetchShares] Supabase error", error);
    console.error("[fetchShares] memoId", memoId.trim());
    throw error;
  }

  return (data ?? []) as MemoShareRow[];
}

export async function addShare(
  client: SupabaseClient,
  memoId: string,
  email: string,
  role: MemoShareRole,
): Promise<MemoShareRow> {
  const shared_with_email = normalizeShareEmail(email);
  if (!shared_with_email) throw new Error("Email is required");

  const { data, error } = await client
    .from("memo_shares")
    .upsert(
      { memo_id: memoId, shared_with_email, role },
      { onConflict: "memo_id,shared_with_email" },
    )
    .select("id,memo_id,shared_with_email,role,created_at")
    .single();

  if (error) {
    logPostgrestError("[addShare] Supabase error", error);
    throw error;
  }
  return data as MemoShareRow;
}

export async function removeShare(client: SupabaseClient, shareId: string): Promise<void> {
  const { error } = await client.from("memo_shares").delete().eq("id", shareId);
  if (error) {
    logPostgrestError("[removeShare] Supabase error", error);
    throw error;
  }
}

export async function updateShareRole(
  client: SupabaseClient,
  shareId: string,
  role: MemoShareRole,
): Promise<void> {
  const { error } = await client.from("memo_shares").update({ role }).eq("id", shareId);
  if (error) {
    logPostgrestError("[updateShareRole] Supabase error", error);
    throw error;
  }
}
