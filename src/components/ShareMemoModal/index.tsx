"use client";

import { useEffect, useMemo, useState } from "react";
import { X, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/types/fileSystem";
import { useShareModalStore } from "@/stores/shareModalStore";
import { useTranslation } from "@/i18n/useTranslation";

type ShareRole = "viewer" | "editor";

type CollaboratorRow = { id: string; email: string; role: ShareRole };

const MOCK_SEED: CollaboratorRow[] = [
  { id: "mock-1", email: "alice@example.com", role: "editor" },
  { id: "mock-2", email: "bob@example.com", role: "viewer" },
];

function nextInviteId() {
  return `invite-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ShareMemoModal({ fileItems }: { fileItems: FileItem[] }) {
  const { t } = useTranslation();
  const isOpen = useShareModalStore((s) => s.isShareModalOpen);
  const shareTargetMemoId = useShareModalStore((s) => s.shareTargetMemoId);
  const closeShareModal = useShareModalStore((s) => s.closeShareModal);

  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("viewer");

  const memoTitle = useMemo(() => {
    if (!shareTargetMemoId) return t("app.memoTitlePlaceholder");
    const item = fileItems.find(
      (f) => f.id === shareTargetMemoId && f.type === "memo",
    );
    return item?.name?.trim() || t("app.memoTitlePlaceholder");
  }, [fileItems, shareTargetMemoId, t]);

  useEffect(() => {
    if (!isOpen || !shareTargetMemoId) return;
    setCollaborators(MOCK_SEED.map((r) => ({ ...r })));
    setInviteEmail("");
    setInviteRole("viewer");
  }, [isOpen, shareTargetMemoId]);

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

  const addInvite = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setCollaborators((prev) => [
      ...prev,
      { id: nextInviteId(), email, role: inviteRole },
    ]);
    setInviteEmail("");
    setInviteRole("viewer");
  };

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
          <section>
            <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              {t("share.collaboratorsSection")}
            </p>
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
                    onChange={(e) =>
                      setCollaborators((prev) =>
                        prev.map((c) =>
                          c.id === row.id
                            ? { ...c, role: e.target.value as ShareRole }
                            : c,
                        ),
                      )
                    }
                    className="border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 outline-none hover:border-zinc-500"
                  >
                    <option value="viewer">{t("share.roleViewer")}</option>
                    <option value="editor">{t("share.roleEditor")}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setCollaborators((prev) =>
                        prev.filter((c) => c.id !== row.id),
                      )
                    }
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center border border-zinc-700/80",
                      "text-zinc-500 transition-colors hover:border-rose-500/45 hover:bg-rose-950/25 hover:text-rose-300",
                    )}
                    aria-label={t("share.removeAria")}
                  >
                    <UserMinus size={13} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-zinc-800/70 pt-4">
            <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              {t("share.inviteSection")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addInvite();
                }}
                placeholder={t("share.emailPlaceholder")}
                className="min-w-0 flex-1 border border-zinc-700/90 bg-zinc-950/80 px-3 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-cyan-500/45 focus:ring-1 focus:ring-cyan-500/20"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as ShareRole)}
                className="border border-zinc-700 bg-zinc-950 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-300 outline-none sm:w-[118px]"
              >
                <option value="viewer">{t("share.inviteViewOnly")}</option>
                <option value="editor">{t("share.inviteCanEdit")}</option>
              </select>
              <button
                type="button"
                onClick={addInvite}
                className="border border-cyan-500/40 bg-cyan-950/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.15em] text-cyan-300/95 transition-colors hover:border-cyan-400/60 hover:bg-cyan-950/40"
              >
                {t("share.addButton")}
              </button>
            </div>
          </section>
        </div>

        <p className="border-t border-zinc-800/60 px-5 py-3 text-[9px] leading-relaxed text-zinc-600">
          {t("share.mockHint")}
        </p>
      </div>
    </div>
  );
}
