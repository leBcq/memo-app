"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/types/fileSystem";
import { useShareModalStore } from "@/stores/shareModalStore";
import { useTranslation } from "@/i18n/useTranslation";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isUuid } from "@/lib/supabaseMemos";
import {
  addShare,
  fetchShares,
  removeShare,
  updateShareRole,
  type MemoShareRole,
} from "@/lib/supabaseShares";

type ShareRole = MemoShareRole;

type CollaboratorRow = { id: string; email: string; role: ShareRole };

/** Log PostgREST / Supabase client errors (code, message, details, hint, plus enumerable fields). */
function logSupabaseError(context: string, err: unknown) {
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

export function ShareMemoModal({ fileItems }: { fileItems: FileItem[] }) {
  const { t } = useTranslation();
  const { user, configured } = useAuth();
  const userId = user?.id ?? null;
  const isOpen = useShareModalStore((s) => s.isShareModalOpen);
  const shareTargetMemoId = useShareModalStore((s) => s.shareTargetMemoId);
  const closeShareModal = useShareModalStore((s) => s.closeShareModal);

  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("viewer");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const memoTitle = useMemo(() => {
    if (!shareTargetMemoId) return t("app.memoTitlePlaceholder");
    const item = fileItems.find(
      (f) => f.id === shareTargetMemoId && f.type === "memo",
    );
    return item?.name?.trim() || t("app.memoTitlePlaceholder");
  }, [fileItems, shareTargetMemoId, t]);

  /** Load owner + share list. Keeps isOwner if owner lookup succeeded even when fetchShares fails. */
  const loadShareData = useCallback(
    async (isAlive: () => boolean) => {
      if (!shareTargetMemoId || !userId) return;
      const client = getSupabaseBrowserClient();
      if (!client) return;

      if (!isAlive()) return;
      setListLoading(true);
      setListError(null);
      setIsOwner(false);
      setCollaborators([]);

      let ownerDetermined = false;
      let ownerMatch = false;

      try {
        if (!isUuid(shareTargetMemoId)) {
          if (!isAlive()) return;
          setListError("uuid");
          setCollaborators([]);
          setIsOwner(false);
          return;
        }

        const ownerRes = await client
          .from("memos")
          .select("user_id")
          .eq("id", shareTargetMemoId)
          .maybeSingle();

        if (!isAlive()) return;

        if (ownerRes.error) {
          logSupabaseError("[ShareMemoModal] memos owner lookup failed", ownerRes.error);
          console.error("[ShareMemoModal] memos owner lookup memoId", shareTargetMemoId);
          throw ownerRes.error;
        }

        ownerDetermined = true;
        ownerMatch = ownerRes.data?.user_id === userId;
        setIsOwner(ownerMatch);

        const rows = await fetchShares(client, shareTargetMemoId);
        if (!isAlive()) return;
        setCollaborators(
          rows.map((r) => ({
            id: r.id,
            email: r.shared_with_email,
            role: r.role,
          })),
        );
      } catch (e) {
        if (!isAlive()) return;
        logSupabaseError("[ShareModal] loadShareData failed", e);
        setListError("fetch");
        setCollaborators([]);
        if (!ownerDetermined) {
          setIsOwner(false);
        }
      } finally {
        if (isAlive()) setListLoading(false);
      }
    },
    [shareTargetMemoId, userId],
  );

  // Only reset invite fields when opening the modal or switching memo (not on auth/session churn).
  useEffect(() => {
    if (!isOpen || !shareTargetMemoId) return;
    setInviteEmail("");
    setInviteRole("viewer");
    setActionError(null);
  }, [isOpen, shareTargetMemoId]);

  useEffect(() => {
    if (!isOpen || !shareTargetMemoId) return;

    if (!configured) {
      setListError("config");
      setCollaborators([]);
      setIsOwner(false);
      setListLoading(false);
      return;
    }
    if (!userId) {
      setListError("signin");
      setCollaborators([]);
      setIsOwner(false);
      setListLoading(false);
      return;
    }

    let alive = true;
    void loadShareData(() => alive);
    return () => {
      alive = false;
    };
  }, [isOpen, shareTargetMemoId, configured, userId, loadShareData]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeShareModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeShareModal]);

  if (!isOpen || !shareTargetMemoId) return null;

  const titleText = t("share.title").replace("{name}", memoTitle);

  const addInvite = async () => {
    setActionError(null);
    const email = inviteEmail.trim();
    if (!email) return;
    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      setActionError(t("share.signInRequired"));
      return;
    }
    if (!isUuid(shareTargetMemoId)) {
      setActionError(t("share.needsCloudId"));
      return;
    }
    if (!isOwner) {
      setActionError(t("share.inviteReadOnly"));
      return;
    }
    setSubmitting(true);
    try {
      await addShare(client, shareTargetMemoId, email, inviteRole);
      setInviteEmail("");
      setInviteRole("viewer");
      await loadShareData(() => true);
    } catch (e) {
      logSupabaseError("[ShareModal] addInvite failed", e);
      setActionError(t("share.saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const removeRow = async (shareId: string) => {
    setActionError(null);
    const client = getSupabaseBrowserClient();
    if (!client) return;
    if (!isOwner) {
      setActionError(t("share.inviteReadOnly"));
      return;
    }
    try {
      await removeShare(client, shareId);
      await loadShareData(() => true);
    } catch (e) {
      logSupabaseError("[ShareModal] removeRow failed", e);
      setActionError(t("share.saveError"));
    }
  };

  const changeRole = async (shareId: string, role: ShareRole) => {
    setActionError(null);
    const client = getSupabaseBrowserClient();
    if (!client) return;
    if (!isOwner) return;
    try {
      await updateShareRole(client, shareId, role);
      setCollaborators((prev) =>
        prev.map((c) => (c.id === shareId ? { ...c, role } : c)),
      );
    } catch (e) {
      logSupabaseError("[ShareModal] changeRole failed", e);
      setActionError(t("share.saveError"));
      await loadShareData(() => true);
    }
  };

  const listErrorText =
    listError === "signin"
      ? t("share.signInRequired")
      : listError === "uuid"
        ? t("share.needsCloudId")
        : listError === "fetch"
          ? t("share.loadError")
          : listError === "config"
            ? t("auth.notConfigured")
            : null;

  /** Allow typing whenever the user is the memo owner; list fetch must not disable the field. */
  const canEditInvites = isOwner && !submitting;

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/65 p-4 backdrop-blur-md transition-opacity duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeShareModal();
      }}
    >
      <div
        className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-hidden border border-zinc-700/85 bg-zinc-950 font-mono shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -left-px -top-px h-5 w-5 border-l-2 border-t-2 border-cyan-500/35" />
        <div className="pointer-events-none absolute -right-px -top-px h-5 w-5 border-r-2 border-t-2 border-cyan-500/35" />
        <div className="pointer-events-none absolute -bottom-px -left-px h-5 w-5 border-b-2 border-l-2 border-zinc-600/40" />
        <div className="pointer-events-none absolute -bottom-px -right-px h-5 w-5 border-b-2 border-r-2 border-zinc-600/40" />

        <header className="flex items-start justify-between gap-3 border-b border-zinc-800/80 px-5 py-4">
          <h2 className="min-w-0 pt-0.5 text-[13px] font-medium leading-snug tracking-wide text-zinc-100">
            {titleText}
          </h2>
          <button
            type="button"
            onClick={closeShareModal}
            className="shrink-0 border border-zinc-700/80 bg-zinc-900/50 p-1.5 text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-100"
            aria-label={t("share.closeAria")}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </header>

        <div className="max-h-[calc(min(90vh,720px)-220px)] space-y-5 overflow-y-auto px-5 py-4">
          {listErrorText ? (
            <p className="text-[11px] text-amber-400/90">{listErrorText}</p>
          ) : null}
          {actionError ? (
            <p className="text-[11px] text-rose-400/90">{actionError}</p>
          ) : null}

          <section>
            <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              {t("share.collaboratorsSection")}
            </p>
            {listLoading ? (
              <p className="text-[11px] text-zinc-500">{t("share.loading")}</p>
            ) : (
              <ul className="space-y-2">
                {collaborators.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2 border border-zinc-800/90 bg-zinc-900/35 px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">
                      {row.email}
                    </span>
                    <select
                      value={row.role}
                      disabled={!isOwner}
                      onChange={(e) =>
                        void changeRole(row.id, e.target.value as ShareRole)
                      }
                      className="border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 outline-none hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="viewer">{t("share.roleViewer")}</option>
                      <option value="editor">{t("share.roleEditor")}</option>
                    </select>
                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => void removeRow(row.id)}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center border border-zinc-700/80",
                        "text-zinc-500 transition-colors hover:border-rose-500/45 hover:bg-rose-950/25 hover:text-rose-300",
                        "disabled:pointer-events-none disabled:opacity-40",
                      )}
                      aria-label={t("share.removeAria")}
                    >
                      <UserMinus size={13} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-zinc-800/70 pt-4">
            <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              {t("share.inviteSection")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="email"
                value={inviteEmail}
                disabled={!canEditInvites}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addInvite();
                }}
                placeholder={t("share.emailPlaceholder")}
                className="min-w-0 flex-1 border border-zinc-700/90 bg-zinc-950/80 px-3 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-cyan-500/45 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50"
              />
              <select
                value={inviteRole}
                disabled={!canEditInvites}
                onChange={(e) => setInviteRole(e.target.value as ShareRole)}
                className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-300 outline-none sm:w-[118px] disabled:opacity-50"
              >
                <option value="viewer">{t("share.inviteViewOnly")}</option>
                <option value="editor">{t("share.inviteCanEdit")}</option>
              </select>
              <button
                type="button"
                disabled={!canEditInvites}
                onClick={() => void addInvite()}
                className="border border-cyan-500/40 bg-cyan-950/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-cyan-300/95 transition-colors hover:border-cyan-400/60 hover:bg-cyan-950/40 disabled:opacity-40"
              >
                {t("share.addButton")}
              </button>
            </div>
            {!isOwner && userId && listError === null && !listLoading ? (
              <p className="mt-2 text-[10px] text-zinc-600">{t("share.inviteReadOnly")}</p>
            ) : null}
          </section>
        </div>

        <p className="border-t border-zinc-800/60 px-5 py-3 text-[9px] leading-relaxed text-zinc-600">
          {t("share.footerHint")}
        </p>
      </div>
    </div>
  );
}
