"use client";

import {
  useEffect, useRef, useState, useLayoutEffect, useMemo, useCallback,
  type CSSProperties,
  type DragEvent, type KeyboardEvent, type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  FolderPlus, Pencil, Trash2, Download, Upload,
  Star, StarOff, Copy, Archive, Settings, FileText,
  Music2, Gamepad2, Music, Smile, Share2, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/useTranslation";
import { useShareModalStore } from "@/stores/shareModalStore";
import { useSidebarFileSelectionStore } from "@/stores/sidebarFileSelectionStore";
import { getMemoThemeColor, hexToRgba } from "@/lib/memoThemeColor";
import type { FileItem, FileItemColor, FileItemLabelPreset } from "@/types/fileSystem";
import { SHARED_WITH_ME_SIDEBAR_PARENT_ID } from "@/types/fileSystem";
import type { MemoType } from "@/types/memoKind";
import type { Memo } from "@/hooks/useMemos";
import { adjustStoredColorAlpha, parseStoredColor } from "@/lib/menuColorUtils";
import { RowTintColorPicker } from "@/components/MenuColorPicker/RowTintColorPicker";
import { SidebarAuthBar } from "@/components/Auth";
import { FreaviaBackupParseError } from "@/lib/freaviaBackup";
import {
  fileItemColorToPickerValue,
  FILE_ITEM_LABEL_SWATCH_HEX,
  hasFileItemLabel,
  isPresetFileItemColor,
  SIDEBAR_LABEL_TINT_ACTIVE,
  SIDEBAR_LABEL_TINT_IDLE,
} from "@/lib/fileItemLabelStyles";

const DRAG_TYPE = "application/geo-memo-item";

function parseDragPayload(raw: string): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (
      p &&
      typeof p === "object" &&
      "ids" in p &&
      Array.isArray((p as { ids: unknown }).ids) &&
      (p as { ids: unknown[] }).ids.every((x) => typeof x === "string")
    ) {
      return (p as { ids: string[] }).ids;
    }
  } catch {
    /* legacy single-id string payload */
  }
  return [raw];
}

function visibleMainTreeOrder(items: FileItem[]): string[] {
  const out: string[] = [];
  const walk = (parentId: string | null) => {
    const children = sortItems(items.filter((i) => i.parentId === parentId));
    for (const c of children) {
      out.push(c.id);
      if (c.type === "folder" && c.isOpen) walk(c.id);
    }
  };
  walk(null);
  return out;
}

function filterTopLevelInSelection(ids: string[], fileItems: FileItem[]): string[] {
  const set = new Set(ids);
  return ids.filter((id) => {
    const it = fileItems.find((i) => i.id === id);
    if (!it) return false;
    return it.parentId == null || !set.has(it.parentId);
  });
}

function computeDragPayloadIds(
  itemId: string,
  selectedFileIds: string[],
  fileItems: FileItem[],
  mainTreeOrder: string[],
): string[] {
  const raw = selectedFileIds.includes(itemId) ? selectedFileIds : [itemId];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  const roots = filterTopLevelInSelection(deduped, fileItems);
  const idx = new Map(mainTreeOrder.map((id, i) => [id, i]));
  return [...roots].sort((a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0));
}

// ─── Local types ─────────────────────────────────────────────────────────────

type DropPosition = "before" | "after" | "inside";
type DropIndicator = { targetId: string; position: DropPosition } | null;
type ContextMenuState =
  | { kind: "item"; item: FileItem; inviteeMenuMode: InviteeSidebarMenuMode; x: number; y: number }
  | { kind: "empty"; x: number; y: number }
  | null;
type DeleteDialogState = { item: FileItem; displayName: string } | null;

type Props = {
  fileItems: FileItem[];
  memos: Memo[];
  /** Signed-in user id — used to detect shared memos and trim context menus. */
  currentUserId: string | null;
  activeMemoId: string;
  width: number;
  onSelectMemo: (id: string) => void;
  onAddMemo: (parentId: string | null, kind: MemoType) => void;
  onSetMemoType: (memoId: string, kind: MemoType) => void;
  onAddFolder: (parentId: string | null, name: string) => void;
  onToggleFolder: (id: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveItems: (draggedIds: string[], targetParentId: string | null, insertBeforeId?: string | null) => void;
  onOpenSettings: () => void;
  onDuplicateMemo: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onSetItemIcon: (id: string, icon: string) => void;
  onSetItemColor: (
    id: string,
    color: FileItemColor | null,
    opts?: { skipHistory?: boolean },
  ) => void;
  onExportMemo: (id: string) => void;
  onExportFullBackup: () => void;
  onImportFullBackup: (file: File) => void | Promise<void>;
  onMemoColorSliderUndoGestureStart?: () => void;
  onMemoColorSliderUndoGestureEnd?: () => void;
  /** Mobile drawer: full-width + scroll top padding for overlay close control (close button lives in page.tsx). */
  mobileDrawerLayout?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function presetLabelKey(item: FileItem): FileItemLabelPreset | null {
  const c = item.color;
  return typeof c === "string" && isPresetFileItemColor(c) ? c : null;
}

type LabelBoost = "idle" | "hover" | "active";

function customLabelBg(item: FileItem, boost: LabelBoost): CSSProperties | undefined {
  const c = item.color;
  if (typeof c !== "string" || isPresetFileItemColor(c)) return undefined;
  const mult = boost === "active" ? 1.35 : boost === "hover" ? 1.22 : 1;
  return { backgroundColor: adjustStoredColorAlpha(c, mult) };
}

function selectedFolderLabelBorder(): string {
  return "border-l-2 border-zinc-600/50 text-zinc-200 ring-1 ring-inset ring-zinc-500/35";
}

function sortItems(items: FileItem[]): FileItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.order - b.order;
  });
}

function isMemoSharedWithMe(memo: Memo | undefined, currentUserId: string | null): boolean {
  return Boolean(memo?.ownerUserId && currentUserId && memo.ownerUserId !== currentUserId);
}

type InviteeSidebarMenuMode = "owner" | "editor" | "viewer";

function inviteeMenuModeForItem(
  item: FileItem,
  memos: Memo[],
  currentUserId: string | null,
): InviteeSidebarMenuMode {
  if (item.type !== "memo") return "owner";
  const m = memos.find((x) => x.id === item.id);
  if (!m?.ownerUserId || !currentUserId || m.ownerUserId === currentUserId) return "owner";
  return m.shareRole === "editor" ? "editor" : "viewer";
}

function getMemoKind(item: FileItem, memo: Memo | undefined): MemoType {
  if (item.type !== "memo") return "standard";
  return item.memoType ?? memo?.memoType ?? "standard";
}

/** Sidebar memo title uses theme (or kind default); works even if `memo` is briefly missing from state. */
function sidebarMemoTitleColor(item: FileItem, memo: Memo | undefined): string {
  const kind = getMemoKind(item, memo);
  return getMemoThemeColor(memo ?? { memoType: kind, themeColor: null });
}

function memoRowInactiveBase(kind: MemoType, hasLabel: boolean): string {
  if (kind === "music") {
    return hasLabel
      ? "border-l-2 border-transparent"
      : "border-l-2 border-transparent bg-transparent hover:bg-fuchsia-900/55";
  }
  return hasLabel
    ? "border-l-2 border-transparent"
    : "border-l-2 border-transparent bg-transparent hover:bg-zinc-700/80";
}

function defaultMemoIconEl(kind: MemoType, size: number, solidHue?: string) {
  const colored = solidHue
    ? { className: "shrink-0", style: { color: solidHue } as CSSProperties }
    : { className: "shrink-0 text-zinc-500", style: undefined };
  if (kind === "music") {
    return <Music size={size} strokeWidth={2} {...colored} />;
  }
  if (kind === "gamedev") {
    return <Gamepad2 size={size} strokeWidth={2} {...colored} />;
  }
  return <FileText size={size} {...colored} />;
}

function calcDropPosition(e: DragEvent, isFolder: boolean): DropPosition {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const pct = (e.clientY - rect.top) / rect.height;
  if (isFolder) {
    if (pct < 0.28) return "before";
    if (pct > 0.72) return "after";
    return "inside";
  }
  return pct < 0.5 ? "before" : "after";
}

type RowLabelCtx = {
  kind: MemoType;
  isActiveMemo: boolean;
  isSelectedFolder: boolean;
  /** Multi-select (Ctrl/Cmd / Shift) — same highlight weight as active */
  isMultiSelected: boolean;
  isFolder: boolean;
  rowHover: boolean;
  dropInside: boolean;
  /** Memo theme `#rrggbb` (opaque); label text / border hints when this row is the active memo. */
  memoThemeSolid: string | null;
  /** Resolves theme fallback when `FileItem.color` is unset. */
  memoForRow?: Memo | undefined;
};

/** Active row background follows sidebar tint alpha; text stays solid via `memoSolid`. */
function activeMemoRowBackgroundFromItem(
  item: FileItem,
  kind: MemoType,
  memo: Memo | undefined,
): string {
  const c = item.color;
  const fallbackSolid = getMemoThemeColor(memo ?? { memoType: kind, themeColor: null });
  if (c == null || c === "" || c === "default") {
    return hexToRgba(fallbackSolid, 0.17);
  }
  if (typeof c === "string" && isPresetFileItemColor(c)) {
    const hex = FILE_ITEM_LABEL_SWATCH_HEX[c];
    return hexToRgba(hex, 0.15);
  }
  const p = parseStoredColor(c);
  if (p) return adjustStoredColorAlpha(c, 1.35);
  return hexToRgba(fallbackSolid, 0.17);
}

function activeMemoRowSurface(
  memoSolid: string,
  rowBackground: string,
): { className: string; style: CSSProperties } {
  return {
    className: "border-l-2 transition-colors",
    style: {
      backgroundColor: rowBackground,
      color: memoSolid,
      borderLeftColor: hexToRgba(memoSolid, 0.55),
      boxShadow: `inset 0 0 0 1px ${hexToRgba(memoSolid, 0.22)}, inset 0 1px 0 ${hexToRgba(memoSolid, 0.1)}`,
    },
  };
}

/** Shared class + inline background for preset vs custom label colors. */
function sidebarRowLabelClassAndStyle(item: FileItem, ctx: RowLabelCtx): {
  className: string;
  style: CSSProperties;
} {
  if (ctx.dropInside) {
    return {
      className: "border-l-2 border-cyan-400/80 bg-cyan-950/30",
      style: {},
    };
  }

  const hasLabel = hasFileItemLabel(item);
  const pk = presetLabelKey(item);
  const tintIdle = pk ? SIDEBAR_LABEL_TINT_IDLE[pk] : "";
  const memoBoostActive = item.type === "memo" && (ctx.isActiveMemo || ctx.isMultiSelected);
  const folderBoostActive = ctx.isFolder && (ctx.isSelectedFolder || ctx.isMultiSelected);
  const boost: LabelBoost =
    memoBoostActive || folderBoostActive
      ? "active"
      : ctx.rowHover
        ? "hover"
        : "idle";
  const labelBg = customLabelBg(item, boost) ?? {};

  if (ctx.isFolder) {
    if ((ctx.isSelectedFolder || ctx.isMultiSelected) && hasLabel) {
      if (pk) {
        return {
          className: cn(selectedFolderLabelBorder(), SIDEBAR_LABEL_TINT_ACTIVE[pk]),
          style: {},
        };
      }
      return { className: selectedFolderLabelBorder(), style: labelBg };
    }
    if (hasLabel) {
      if (pk) {
        return {
          className: cn(
            "border-l-2 border-transparent text-zinc-400",
            tintIdle,
            "hover:text-zinc-200",
          ),
          style: {},
        };
      }
      return {
        className: "border-l-2 border-transparent text-zinc-400 hover:text-zinc-200",
        style: labelBg,
      };
    }
    return {
      className:
        "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-700/80 hover:text-zinc-200",
      style: {},
    };
  }

  if ((ctx.isActiveMemo || ctx.isMultiSelected) && item.type === "memo") {
    const solid = ctx.memoThemeSolid ?? "#e4e4e7";
    const bg = activeMemoRowBackgroundFromItem(item, ctx.kind, ctx.memoForRow);
    return activeMemoRowSurface(solid, bg);
  }
  if (hasLabel) {
    if (pk) {
      return { className: cn(memoRowInactiveBase(ctx.kind, true), tintIdle), style: {} };
    }
    return { className: memoRowInactiveBase(ctx.kind, true), style: labelBg };
  }
  return { className: memoRowInactiveBase(ctx.kind, false), style: {} };
}

function sharedMemoIconEl(size: number, solidHue?: string) {
  const colored = solidHue
    ? { className: "shrink-0", style: { color: solidHue } as CSSProperties }
    : { className: "shrink-0 text-cyan-500/85", style: undefined };
  return <Users size={size} strokeWidth={2} {...colored} />;
}

function FavoriteItemRow({
  item,
  depth,
  fileItems,
  memos,
  activeMemoId,
  mainTreeOrder,
  selectedFileIds,
  draggingIds,
  onRowDragStart,
  onRowDragEnd,
  onSelectMemo,
  onContextMenu,
  localOpen,
  toggleLocal,
  currentUserId,
}: {
  item: FileItem;
  depth: number;
  fileItems: FileItem[];
  memos: Memo[];
  activeMemoId: string;
  mainTreeOrder: string[];
  selectedFileIds: string[];
  draggingIds: string[];
  onRowDragStart: (e: DragEvent<HTMLDivElement>, item: FileItem) => void;
  onRowDragEnd: () => void;
  onSelectMemo: (id: string) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>, item: FileItem) => void;
  localOpen: Set<string>;
  toggleLocal: (id: string) => void;
  currentUserId: string | null;
}) {
  const { t } = useTranslation();
  const [rowHover, setRowHover] = useState(false);
  const isFolder = item.type === "folder";
  const isLocalOpen = localOpen.has(item.id);
  const isActive = item.type === "memo" && item.id === activeMemoId;
  const isMultiSelected = selectedFileIds.includes(item.id);
  const memo = item.type === "memo" ? memos.find((m) => m.id === item.id) : undefined;
  const sharedWithMe = item.type === "memo" && isMemoSharedWithMe(memo, currentUserId);
  const kind = isFolder ? "standard" : getMemoKind(item, memo);
  const displayName = isFolder ? item.name : (memo?.title || t("sidebar.untitledMemo"));
  const memoTitleHue = !isFolder ? sidebarMemoTitleColor(item, memo) : "";
  const folderIcon = isLocalOpen ? "📂" : "📁";
  const memoIcon = item.icon ? (
    <span className="shrink-0 leading-none">{item.icon}</span>
  ) : sharedWithMe ? (
    sharedMemoIconEl(9, isActive || isMultiSelected ? memoTitleHue : undefined)
  ) : (
    defaultMemoIconEl(kind, 9, isActive || isMultiSelected ? memoTitleHue : undefined)
  );

  const { className: labelClass, style: labelStyle } = sidebarRowLabelClassAndStyle(item, {
    kind,
    isActiveMemo: isActive,
    isSelectedFolder: false,
    isMultiSelected,
    isFolder,
    rowHover,
    dropInside: false,
    memoThemeSolid: item.type === "memo" ? sidebarMemoTitleColor(item, memo) : null,
    memoForRow: item.type === "memo" ? memo : undefined,
  });

  const handleClick = () => {
    if (isFolder) toggleLocal(item.id);
    else onSelectMemo(item.id);
  };

  const handleRowClick = (e: MouseEvent<HTMLDivElement>) => {
    const idx = mainTreeOrder.indexOf(item.id);
    const sel = useSidebarFileSelectionStore.getState();

    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const anchor = sel.lastClickedTreeIndex ?? idx;
      if (idx >= 0 && anchor >= 0) sel.setRange(mainTreeOrder, anchor, idx);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      sel.toggleSelect(item.id);
      if (idx >= 0) sel.setLastClickedTreeIndex(idx);
      return;
    }

    sel.clearMultiSelect();
    if (idx >= 0) sel.setLastClickedTreeIndex(idx);
    handleClick();
  };

  const children = sortItems(fileItems.filter((i) => i.parentId === item.id));
  const isDragging = draggingIds.includes(item.id);

  return (
    <div>
      <div
        draggable={!(item.type === "memo" && sharedWithMe)}
        onDragStart={(e) => onRowDragStart(e, item)}
        onDragEnd={onRowDragEnd}
        className={cn(
          labelClass,
          "group flex w-full min-w-0 items-center gap-1.5 py-[3px] pr-2 font-mono text-[11px] tracking-wide transition-colors active:cursor-grabbing",
          isFolder ? "cursor-pointer" : "cursor-grab",
          isDragging && "opacity-40",
        )}
        style={{ ...labelStyle, paddingLeft: `${20 + depth * 12}px` }}
        onMouseEnter={() => setRowHover(true)}
        onMouseLeave={() => setRowHover(false)}
        onClick={handleRowClick}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu(e, item);
        }}
      >
        {isFolder ? (
          <span
            className={cn(
              "flex h-3 w-3 shrink-0 items-center justify-center text-[8px] transition-transform duration-200 text-zinc-600",
              isLocalOpen && "rotate-90",
            )}
          >
            ▶
          </span>
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}

        <span className="flex h-[13px] w-[13px] shrink-0 items-center justify-center text-[11px]">
          {isFolder ? folderIcon : memoIcon}
        </span>

        <span
          className="min-w-0 flex-1 truncate"
          style={!isFolder && !isActive && !isMultiSelected ? { color: memoTitleHue } : undefined}
          title={displayName}
        >
          {displayName || (
            <span
              className="italic opacity-55"
              style={!isFolder && !isActive && !isMultiSelected ? { color: memoTitleHue } : undefined}
            >
              {t("sidebar.untitledMemo")}
            </span>
          )}
        </span>

        {item.isBookmarked && depth > 0 && (
          <Star size={8} className="shrink-0 fill-amber-400/80 text-amber-400/80" />
        )}
      </div>

      {isFolder && (
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-in-out",
            isLocalOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {children.map((child) => (
              <FavoriteItemRow
                key={child.id}
                item={child}
                depth={depth + 1}
                fileItems={fileItems}
                memos={memos}
                activeMemoId={activeMemoId}
                mainTreeOrder={mainTreeOrder}
                selectedFileIds={selectedFileIds}
                draggingIds={draggingIds}
                onRowDragStart={onRowDragStart}
                onRowDragEnd={onRowDragEnd}
                onSelectMemo={onSelectMemo}
                onContextMenu={onContextMenu}
                localOpen={localOpen}
                toggleLocal={toggleLocal}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared with me (invitee) ─────────────────────────────────────────────────

function SharedWithMeSection({
  fileItems,
  memos,
  activeMemoId,
  currentUserId,
  mainTreeOrder,
  selectedFileIds,
  draggingIds,
  onRowDragStart,
  onRowDragEnd,
  onSelectMemo,
  onContextMenu,
}: {
  fileItems: FileItem[];
  memos: Memo[];
  activeMemoId: string;
  currentUserId: string | null;
  mainTreeOrder: string[];
  selectedFileIds: string[];
  draggingIds: string[];
  onRowDragStart: (e: DragEvent<HTMLDivElement>, item: FileItem) => void;
  onRowDragEnd: () => void;
  onSelectMemo: (id: string) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>, item: FileItem) => void;
}) {
  const { t } = useTranslation();
  const [sectionOpen, setSectionOpen] = useState(true);
  const [localOpen, setLocalOpen] = useState<Set<string>>(new Set());
  const toggleLocal = (id: string) =>
    setLocalOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const shared = useMemo(() => {
    const memoById = new Map(memos.map((m) => [m.id, m]));
    return sortItems(
      fileItems.filter((i) => {
        if (i.type !== "memo" || !currentUserId) return false;
        if (i.parentId === SHARED_WITH_ME_SIDEBAR_PARENT_ID) return true;
        const m = memoById.get(i.id);
        return isMemoSharedWithMe(m, currentUserId);
      }),
    );
  }, [fileItems, memos, currentUserId]);

  if (!currentUserId || shared.length === 0) return null;

  return (
    <div className="border-b border-zinc-800/70">
      <button
        type="button"
        onClick={() => setSectionOpen((p) => !p)}
        onContextMenu={(e) => e.stopPropagation()}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] tracking-[2px] text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <svg
          className={cn(
            "h-[6px] w-[6px] shrink-0 text-cyan-500/65 transition-transform duration-150",
            sectionOpen && "rotate-90",
          )}
          viewBox="0 0 8 8"
          fill="currentColor"
        >
          <polygon points="1,1 7,4 1,7" />
        </svg>
        <Users size={9} className="shrink-0 text-cyan-500/70" />
        <span>{t("sidebar.sharedWithMe")}</span>
        <span className="ml-auto text-zinc-700">{shared.length}</span>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          sectionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {shared.map((item) => (
            <FavoriteItemRow
              key={item.id}
              item={item}
              depth={0}
              fileItems={fileItems}
              memos={memos}
              activeMemoId={activeMemoId}
              mainTreeOrder={mainTreeOrder}
              selectedFileIds={selectedFileIds}
              draggingIds={draggingIds}
              onRowDragStart={onRowDragStart}
              onRowDragEnd={onRowDragEnd}
              onSelectMemo={onSelectMemo}
              onContextMenu={onContextMenu}
              localOpen={localOpen}
              toggleLocal={toggleLocal}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Favorites section ────────────────────────────────────────────────────────

function FavoritesSection({
  fileItems,
  memos,
  activeMemoId,
  currentUserId,
  mainTreeOrder,
  selectedFileIds,
  draggingIds,
  onRowDragStart,
  onRowDragEnd,
  onSelectMemo,
  onToggleFavorite,
  onContextMenu,
}: {
  fileItems: FileItem[];
  memos: Memo[];
  activeMemoId: string;
  currentUserId: string | null;
  mainTreeOrder: string[];
  selectedFileIds: string[];
  draggingIds: string[];
  onRowDragStart: (e: DragEvent<HTMLDivElement>, item: FileItem) => void;
  onRowDragEnd: () => void;
  onSelectMemo: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>, item: FileItem) => void;
}) {
  const { t } = useTranslation();
  const [sectionOpen, setSectionOpen] = useState(true);
  // Local open-state for folders INSIDE favorites — independent from main tree isOpen
  const [localOpen, setLocalOpen] = useState<Set<string>>(new Set());

  const toggleLocal = (id: string) =>
    setLocalOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const favorites = fileItems.filter((i) => i.isBookmarked);
  if (favorites.length === 0) return null;

  return (
    <div className="border-b border-zinc-800/70">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setSectionOpen((p) => !p)}
        onContextMenu={(e) => e.stopPropagation()}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] tracking-[2px] text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <svg
          className={cn("h-[6px] w-[6px] shrink-0 text-amber-400/70 transition-transform duration-150", sectionOpen && "rotate-90")}
          viewBox="0 0 8 8" fill="currentColor">
          <polygon points="1,1 7,4 1,7" />
        </svg>
        <Star size={9} className="shrink-0 text-amber-400/70" />
        <span>{t("sidebar.favorites")}</span>
        <span className="ml-auto text-zinc-700">{favorites.length}</span>
      </button>

      {/* Items */}
      <div className={cn("grid transition-[grid-template-rows] duration-200", sectionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          {favorites.map((item) => (
            <FavoriteItemRow
              key={item.id}
              item={item}
              depth={0}
              fileItems={fileItems}
              memos={memos}
              activeMemoId={activeMemoId}
              mainTreeOrder={mainTreeOrder}
              selectedFileIds={selectedFileIds}
              draggingIds={draggingIds}
              onRowDragStart={onRowDragStart}
              onRowDragEnd={onRowDragEnd}
              onSelectMemo={onSelectMemo}
              onContextMenu={onContextMenu}
              localOpen={localOpen}
              toggleLocal={toggleLocal}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function FileSidebar({
  fileItems,
  memos,
  currentUserId,
  activeMemoId,
  width,
  onSelectMemo, onAddMemo, onSetMemoType, onAddFolder,
  onToggleFolder, onRenameItem, onDeleteItem, onMoveItems, onOpenSettings,
  onDuplicateMemo, onToggleBookmark, onSetItemIcon, onSetItemColor, onExportMemo,
  onExportFullBackup,
  onImportFullBackup,
  onMemoColorSliderUndoGestureStart,
  onMemoColorSliderUndoGestureEnd,
  mobileDrawerLayout,
}: Props) {
  const { t } = useTranslation();
  const openShareModal = useShareModalStore((s) => s.openShareModal);
  const selectedFileIds = useSidebarFileSelectionStore((s) => s.selectedFileIds);
  const mainTreeOrder = useMemo(() => visibleMainTreeOrder(fileItems), [fileItems]);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [iconEditingId, setIconEditingId] = useState<string | null>(null);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  const handleRowDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, item: FileItem) => {
      e.dataTransfer.effectAllowed = "move";
      const ids = computeDragPayloadIds(
        item.id,
        useSidebarFileSelectionStore.getState().selectedFileIds,
        fileItems,
        mainTreeOrder,
      );
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ ids }));
      requestAnimationFrame(() => setDraggingIds(ids));
    },
    [fileItems, mainTreeOrder],
  );

  const handleRowDragEnd = useCallback(() => {
    setDraggingIds([]);
    setDropIndicator(null);
  }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const importBackupInputRef = useRef<HTMLInputElement>(null);

  const commitNewFolder = () => {
    if (newFolderParentId !== undefined) {
      if (newFolderName.trim()) onAddFolder(newFolderParentId, newFolderName.trim());
      setNewFolderParentId(undefined);
      setNewFolderName("");
    }
  };

  const applyDropOnItem = (ids: string[], targetItem: FileItem, position: DropPosition) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    if (position === "inside" && targetItem.type === "folder") {
      onMoveItems(ids, targetItem.id, null);
    } else if (position === "before") {
      onMoveItems(ids, targetItem.parentId, targetItem.id);
    } else {
      const sortedSiblings = sortItems(
        fileItems.filter((i) => i.parentId === targetItem.parentId && !idSet.has(i.id)),
      );
      const idx = sortedSiblings.findIndex((i) => i.id === targetItem.id);
      const nextSibling = sortedSiblings[idx + 1];
      onMoveItems(ids, targetItem.parentId, nextSibling?.id ?? null);
    }
    setDraggingIds([]);
    setDropIndicator(null);
  };

  // Helper to get display name for any file item
  const getDisplayName = (item: FileItem): string => {
    if (item.type === "memo") {
      return memos.find((m) => m.id === item.id)?.title || t("sidebar.untitledMemo");
    }
    return item.name || t("sidebar.untitledFolder");
  };

  const openDeleteDialog = (item: FileItem) => {
    setContextMenu(null);
    setDeleteDialog({ item, displayName: getDisplayName(item) });
  };

  const sharedTreeProps: Omit<TreeProps, "parentId" | "depth"> = {
    items: fileItems,
    memos,
    currentUserId,
    activeMemoId,
    selectedFolderId,
    renamingId,
    draggingIds,
    dropIndicator,
    mainTreeOrder,
    selectedFileIds,
    onRowDragStart: handleRowDragStart,
    onRowDragEnd: handleRowDragEnd,
    onSelectMemo,
    onSelectFolder: (id) => setSelectedFolderId((p) => (p === id ? null : id)),
    onToggleFolder,
    onStartRename: (id) => setRenamingId(id),
    onCommitRename: (id, name) => { onRenameItem(id, name); setRenamingId(null); },
    onDelete: (id) => {
      const item = fileItems.find((i) => i.id === id);
      if (item) openDeleteDialog(item);
    },
    newFolderParentId,
    newFolderName,
    newFolderInputRef,
    onNewFolderChange: setNewFolderName,
    onNewFolderCommit: commitNewFolder,
    onNewFolderCancel: () => { setNewFolderParentId(undefined); setNewFolderName(""); },
    onDragOverItem: (e, item) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      setDropIndicator({ targetId: item.id, position: calcDropPosition(e, item.type === "folder") });
    },
    onDragLeaveItem: (item) => {
      setDropIndicator((prev) => (prev?.targetId === item.id ? null : prev));
    },
    onDropOnItem: (e, item) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dropIndicator || dropIndicator.targetId !== item.id) return;
      const fromData = parseDragPayload(e.dataTransfer.getData(DRAG_TYPE));
      const ids = draggingIds.length > 0 ? draggingIds : fromData;
      applyDropOnItem(ids, item, dropIndicator.position);
    },
    onContextMenu: (e, item) => {
      e.preventDefault();
      e.stopPropagation();
      const menuW = 220;
      const menuH = item.type === "folder" ? 420 : 520;
      setContextMenu({
        kind: "item",
        item,
        inviteeMenuMode: inviteeMenuModeForItem(item, memos, currentUserId),
        x: Math.min(e.clientX, window.innerWidth - menuW - 4),
        y: Math.min(e.clientY, window.innerHeight - menuH - 4),
      });
    },
    iconEditingId,
    onStartIconEdit: (id) => { setIconEditingId(id); setContextMenu(null); },
    onCommitIconEdit: (id, icon) => { onSetItemIcon(id, icon); setIconEditingId(null); },
  };

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 shrink-0 flex-col overflow-x-hidden bg-zinc-950",
        mobileDrawerLayout && "w-full min-w-0",
      )}
      style={mobileDrawerLayout ? undefined : { width }}
    >
      {/* Desktop header — outside scroll */}
      <div className="hidden items-center justify-between gap-2 border-b border-zinc-800/70 px-3 py-2 md:flex">
        <span className="font-mono text-[9px] tracking-[3px] text-zinc-600">{t("sidebar.myFiles")}</span>
      </div>

      {/* Scroll area — mobile: pt for page-level close FAB */}
      <div
        className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden", mobileDrawerLayout && "max-md:pt-16")}
        onContextMenu={(e) => {
          e.preventDefault();
          const menuW = 220;
          const menuH = 240;
          setContextMenu({
            kind: "empty",
            x: Math.min(e.clientX, window.innerWidth - menuW - 4),
            y: Math.min(e.clientY, window.innerHeight - menuH - 4),
          });
        }}
      >
        {mobileDrawerLayout ? (
          <div
            className="border-b border-zinc-800/70 px-3 py-2 md:hidden"
            onContextMenu={(e) => e.stopPropagation()}
          >
            <span className="font-mono text-[9px] tracking-[3px] text-zinc-600">
              {t("sidebar.myFiles")}
            </span>
          </div>
        ) : null}

        {/* Favorites section (above the tree) */}
        <FavoritesSection
          fileItems={fileItems}
          memos={memos}
          activeMemoId={activeMemoId}
          currentUserId={currentUserId}
          mainTreeOrder={mainTreeOrder}
          selectedFileIds={selectedFileIds}
          draggingIds={draggingIds}
          onRowDragStart={handleRowDragStart}
          onRowDragEnd={handleRowDragEnd}
          onSelectMemo={onSelectMemo}
          onToggleFavorite={onToggleBookmark}
          onContextMenu={sharedTreeProps.onContextMenu}
        />

        <SharedWithMeSection
          fileItems={fileItems}
          memos={memos}
          activeMemoId={activeMemoId}
          currentUserId={currentUserId}
          mainTreeOrder={mainTreeOrder}
          selectedFileIds={selectedFileIds}
          draggingIds={draggingIds}
          onRowDragStart={handleRowDragStart}
          onRowDragEnd={handleRowDragEnd}
          onSelectMemo={onSelectMemo}
          onContextMenu={sharedTreeProps.onContextMenu}
        />

        {/* File tree */}
        <div className="py-1">
          <FileTree parentId={null} depth={0} {...sharedTreeProps} />

          {draggingIds.length > 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setRootDropActive(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRootDropActive(false); }}
              onDrop={(e) => {
                e.preventDefault();
                const fromState = draggingIds.length > 0 ? draggingIds : parseDragPayload(e.dataTransfer.getData(DRAG_TYPE));
                if (fromState.length > 0) onMoveItems(fromState, null, null);
                setDraggingIds([]);
                setDropIndicator(null);
                setRootDropActive(false);
              }}
              className={cn(
                "mx-2 mt-1 flex items-center justify-center border border-dashed py-1.5 font-mono text-[9px] tracking-widest transition-colors",
                rootDropActive ? "border-cyan-500/60 bg-cyan-950/20 text-cyan-500/80" : "border-zinc-700/40 text-zinc-700",
              )}
            >
              {t("sidebar.moveToRoot")}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="space-y-1 border-t border-zinc-800/70 p-2">
        <button
          type="button"
          onClick={() => onAddMemo(selectedFolderId, "standard")}
          className="flex w-full items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wide text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-cyan-400"
        >
          <span className="text-[12px] leading-none">+</span>
          <FileText size={11} className="shrink-0 opacity-70" />
          <span>{t("sidebar.standardMemo")}</span>
          {selectedFolderId && <span className="ml-auto text-[9px] text-zinc-700">{t("sidebar.inFolder")}</span>}
        </button>
        <button
          type="button"
          onClick={() => onAddMemo(selectedFolderId, "music")}
          className="flex w-full items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wide text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-fuchsia-300/90"
        >
          <span className="text-[12px] leading-none">+</span>
          <Music2 size={11} className="shrink-0 opacity-80" />
          <span>{t("sidebar.musicMemo")}</span>
          {selectedFolderId && <span className="ml-auto text-[9px] text-zinc-700">{t("sidebar.inFolder")}</span>}
        </button>
        <button
          type="button"
          onClick={() => onAddMemo(selectedFolderId, "gamedev")}
          className="flex w-full items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wide text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-cyan-300/90"
        >
          <span className="text-[12px] leading-none">+</span>
          <Gamepad2 size={11} className="shrink-0 opacity-80" />
          <span>{t("sidebar.gamedevMemo")}</span>
          {selectedFolderId && <span className="ml-auto text-[9px] text-zinc-700">{t("sidebar.inFolder")}</span>}
        </button>
        <button type="button"
          onClick={() => {
            setNewFolderParentId(selectedFolderId);
            setNewFolderName("");
            requestAnimationFrame(() => newFolderInputRef.current?.focus());
          }}
          className="flex w-full items-center gap-1.5 px-2 py-1 font-mono text-[10px] tracking-wide text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300">
          <span className="text-[12px] leading-none">+</span>
          <span>{t("sidebar.newFolder")}</span>
        </button>
        <div className="mt-1 border-t border-zinc-800/50 pt-1">
          <button
            type="button"
            onClick={onExportFullBackup}
            className="flex w-full items-center gap-2 px-2 py-1.5 font-mono text-[10px] tracking-wide text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            title={t("sidebar.exportTitle")}
          >
            <Download size={11} className="shrink-0 opacity-60" strokeWidth={2} />
            <span>{t("sidebar.exportDataJson")}</span>
          </button>
          <input
            ref={importBackupInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              input.value = "";
              if (!file) return;
              try {
                await Promise.resolve(onImportFullBackup(file));
              } catch (err) {
                const msg =
                  err instanceof FreaviaBackupParseError
                    ? err.code === "INVALID_JSON"
                      ? t("sidebar.importErrorInvalidJson")
                      : t("sidebar.importErrorInvalidBackup")
                    : err instanceof Error
                      ? err.message
                      : t("sidebar.importErrorRead");
                window.alert(msg);
              }
            }}
          />
          <button
            type="button"
            onClick={() => importBackupInputRef.current?.click()}
            className="flex w-full items-center gap-2 px-2 py-1.5 font-mono text-[10px] tracking-wide text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            title={t("sidebar.importTitle")}
          >
            <Upload size={11} className="shrink-0 opacity-60" strokeWidth={2} />
            <span>{t("sidebar.importDataJson")}</span>
          </button>
          <button type="button" onClick={onOpenSettings}
            className="flex w-full items-center gap-2 px-2 py-1.5 font-mono text-[10px] tracking-wide text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-300">
            <Settings size={11} className="shrink-0" />
            <span>{t("sidebar.settings")}</span>
          </button>
          <div className="pt-1">
            <SidebarAuthBar />
          </div>
        </div>
      </div>

      {/* Right-click context menu (item or empty space) */}
      {contextMenu?.kind === "item" ? (
        <SidebarContextMenu
          item={contextMenu.item}
          activeMemoId={activeMemoId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onRename={() => { setRenamingId(contextMenu.item.id); setContextMenu(null); }}
          onDelete={() => openDeleteDialog(contextMenu.item)}
          onAddMemoInside={(kind) => {
            onAddMemo(contextMenu.item.id, kind);
            setContextMenu(null);
          }}
          onSetMemoType={(kind) => {
            onSetMemoType(contextMenu.item.id, kind);
            setContextMenu(null);
          }}
          onAddFolderInside={() => {
            setNewFolderParentId(contextMenu.item.id);
            setNewFolderName("");
            setContextMenu(null);
            requestAnimationFrame(() => newFolderInputRef.current?.focus());
          }}
          onDuplicate={() => { onDuplicateMemo(contextMenu.item.id); setContextMenu(null); }}
          onToggleFavorite={() => { onToggleBookmark(contextMenu.item.id); setContextMenu(null); }}
          onChangeIcon={() => { setIconEditingId(contextMenu.item.id); setContextMenu(null); }}
          onSetItemLabelColor={(next, opts) => {
            onSetItemColor(contextMenu.item.id, next, opts);
          }}
          onMemoColorSliderUndoGestureStart={onMemoColorSliderUndoGestureStart}
          onMemoColorSliderUndoGestureEnd={onMemoColorSliderUndoGestureEnd}
          onExport={() => { onExportMemo(contextMenu.item.id); setContextMenu(null); }}
          onArchive={() => { window.alert(t("sidebar.archiveSoon")); setContextMenu(null); }}
          onShare={() => {
            openShareModal(contextMenu.item.id);
            setContextMenu(null);
          }}
          inviteeMenuMode={contextMenu.inviteeMenuMode}
        />
      ) : contextMenu?.kind === "empty" ? (
        <SidebarEmptySpaceContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddStandard={() => {
            onAddMemo(null, "standard");
            setContextMenu(null);
          }}
          onAddMusic={() => {
            onAddMemo(null, "music");
            setContextMenu(null);
          }}
          onAddGamedev={() => {
            onAddMemo(null, "gamedev");
            setContextMenu(null);
          }}
          onAddFolder={() => {
            setNewFolderParentId(null);
            setNewFolderName("");
            setContextMenu(null);
            requestAnimationFrame(() => newFolderInputRef.current?.focus());
          }}
        />
      ) : null}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <DeleteConfirmDialog
          item={deleteDialog.item}
          displayName={deleteDialog.displayName}
          onConfirm={() => { onDeleteItem(deleteDialog.item.id); setDeleteDialog(null); }}
          onCancel={() => setDeleteDialog(null)}
        />
      )}
    </aside>
  );
}

// ─── Recursive tree ───────────────────────────────────────────────────────────

type TreeProps = {
  items: FileItem[];
  memos: Memo[];
  currentUserId: string | null;
  parentId: string | null;
  depth: number;
  activeMemoId: string;
  selectedFolderId: string | null;
  renamingId: string | null;
  draggingIds: string[];
  dropIndicator: DropIndicator;
  mainTreeOrder: string[];
  selectedFileIds: string[];
  onRowDragStart: (e: DragEvent<HTMLDivElement>, item: FileItem) => void;
  onRowDragEnd: () => void;
  onSelectMemo: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  newFolderParentId: string | null | undefined;
  newFolderName: string;
  newFolderInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onNewFolderChange: (v: string) => void;
  onNewFolderCommit: () => void;
  onNewFolderCancel: () => void;
  onDragOverItem: (e: DragEvent<HTMLDivElement>, item: FileItem) => void;
  onDragLeaveItem: (item: FileItem) => void;
  onDropOnItem: (e: DragEvent<HTMLDivElement>, item: FileItem) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>, item: FileItem) => void;
  iconEditingId: string | null;
  onStartIconEdit: (id: string) => void;
  onCommitIconEdit: (id: string, icon: string) => void;
};

function FileTree(props: TreeProps) {
  const { items, parentId } = props;
  const children = sortItems(items.filter((i) => i.parentId === parentId));
  return (
    <>
      {children.map((item) => <FileNode key={item.id} item={item} {...props} />)}
      {props.newFolderParentId === parentId && props.newFolderParentId !== undefined && (
        <NewFolderRow
          depth={props.depth}
          value={props.newFolderName}
          inputRef={props.newFolderInputRef}
          onChange={props.onNewFolderChange}
          onCommit={props.onNewFolderCommit}
          onCancel={props.onNewFolderCancel}
        />
      )}
    </>
  );
}

// ─── Single file/folder row ───────────────────────────────────────────────────

function FileNode({
  item, memos, currentUserId, depth, activeMemoId, selectedFolderId, renamingId, draggingIds, dropIndicator,
  mainTreeOrder,
  selectedFileIds,
  iconEditingId, onStartIconEdit, onCommitIconEdit,
  onSelectMemo, onSelectFolder, onToggleFolder, onStartRename, onCommitRename, onDelete,
  onRowDragStart, onRowDragEnd, onDragOverItem, onDragLeaveItem, onDropOnItem, onContextMenu,
  ...rest
}: TreeProps & { item: FileItem }) {
  const { t } = useTranslation();

  const memo = item.type === "memo" ? memos.find((m) => m.id === item.id) : undefined;
  const sharedWithMe = item.type === "memo" && isMemoSharedWithMe(memo, currentUserId);
  const kind = item.type === "memo" ? getMemoKind(item, memo) : "standard";
  const displayName = item.type === "memo" ? (memo?.title || t("sidebar.untitledMemo")) : item.name;
  const memoTitleHue = item.type === "memo" ? sidebarMemoTitleColor(item, memo) : "";
  const [renameVal, setRenameVal] = useState(displayName);
  const [iconVal, setIconVal] = useState(item.icon ?? "");
  const [rowHover, setRowHover] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const isActiveMemo     = item.type === "memo"   && item.id === activeMemoId;
  const isSelectedFolder = item.type === "folder" && item.id === selectedFolderId;
  const isMultiSelected  = selectedFileIds.includes(item.id);
  const isRenaming       = renamingId === item.id;
  const isIconEditing    = iconEditingId === item.id;
  const isDragging       = draggingIds.includes(item.id);
  const indPos           = dropIndicator?.targetId === item.id ? dropIndicator.position : null;
  const indent           = depth * 12;

  const { className: labelClass, style: labelStyle } = sidebarRowLabelClassAndStyle(item, {
    kind,
    isActiveMemo,
    isSelectedFolder,
    isMultiSelected,
    isFolder: item.type === "folder",
    rowHover,
    dropInside: indPos === "inside",
    memoThemeSolid: item.type === "memo" ? sidebarMemoTitleColor(item, memo) : null,
    memoForRow: item.type === "memo" ? memo : undefined,
  });

  // Focus icon input when editing starts
  useEffect(() => {
    if (isIconEditing) {
      setIconVal(item.icon ?? "");
      requestAnimationFrame(() => iconInputRef.current?.focus());
    }
  }, [isIconEditing, item.icon]);

  const handleClick = () => {
    if (item.type === "folder") { onToggleFolder(item.id); onSelectFolder(item.id); }
    else onSelectMemo(item.id);
  };

  const commitRename = () => onCommitRename(item.id, renameVal.trim() || displayName);
  const commitIconEdit = () => onCommitIconEdit(item.id, iconVal.trim());

  const rowInnerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isRenaming || isIconEditing) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-sidebar-no-toggle="true"]')) return;
    if (target.closest("input, textarea, button, a")) return;

    const idx = mainTreeOrder.indexOf(item.id);
    const sel = useSidebarFileSelectionStore.getState();

    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const anchor = sel.lastClickedTreeIndex ?? idx;
      if (idx >= 0 && anchor >= 0) sel.setRange(mainTreeOrder, anchor, idx);
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      sel.toggleSelect(item.id);
      if (idx >= 0) sel.setLastClickedTreeIndex(idx);
      return;
    }

    sel.clearMultiSelect();
    if (idx >= 0) sel.setLastClickedTreeIndex(idx);
    handleClick();
  };

  const handleRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") { setRenameVal(displayName); onCommitRename(item.id, item.name); }
  };

  const handleIconKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitIconEdit(); }
    if (e.key === "Escape") { onCommitIconEdit(item.id, item.icon ?? ""); }
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    onRowDragStart(e, item);
  };

  // Resolve icon to display
  const folderIcon = indPos === "inside" || item.isOpen ? "📂" : "📁";
  const memoIcon = item.icon ? (
    <span className="shrink-0 leading-none">{item.icon}</span>
  ) : sharedWithMe ? (
    sharedMemoIconEl(10, isActiveMemo || isMultiSelected ? memoTitleHue : undefined)
  ) : (
    defaultMemoIconEl(kind, 10, isActiveMemo || isMultiSelected ? memoTitleHue : undefined)
  );

  return (
    <div>
      {indPos === "before" && (
        <div className="pointer-events-none mx-1 h-0.5 bg-cyan-400/80 shadow-[0_0_4px_rgba(34,211,238,0.5)]"
          style={{ marginLeft: `${indent + 6}px` }} />
      )}

      <div
        draggable={!(item.type === "memo" && sharedWithMe)}
        onDragStart={handleDragStart}
        onDragEnd={onRowDragEnd}
        onDragOver={(e) => onDragOverItem(e, item)}
        onDragLeave={() => onDragLeaveItem(item)}
        onDrop={(e) => onDropOnItem(e, item)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, item);
        }}
        onMouseEnter={() => setRowHover(true)}
        onMouseLeave={() => setRowHover(false)}
        onClick={rowInnerClick}
        className={cn(
          labelClass,
          "group flex w-full min-w-0 items-center gap-1 py-[3px] pr-1 font-mono text-[11px] tracking-wide transition-colors active:cursor-grabbing",
          item.type === "folder" && !isRenaming ? "cursor-pointer" : "cursor-grab",
          isDragging && "opacity-40",
        )}
        style={{ ...labelStyle, paddingLeft: `${indent + 8}px` }}
      >
        {/* Chevron */}
        {item.type === "folder" ? (
          <span className={cn(
            "flex h-3 w-3 shrink-0 items-center justify-center text-[8px] transition-transform duration-200",
            indPos === "inside" ? "text-cyan-400/80" : "text-zinc-600",
            item.isOpen && "rotate-90",
          )}>▶</span>
        ) : <span className="h-3 w-3 shrink-0" />}

        {/* Icon — emoji input when editing */}
        {isIconEditing && item.type === "memo" ? (
          <input
            ref={iconInputRef}
            value={iconVal}
            maxLength={2}
            placeholder="😀"
            onChange={(e) => setIconVal(e.target.value)}
            onBlur={commitIconEdit}
            onKeyDown={handleIconKey}
            className="w-8 shrink-0 bg-zinc-800 px-0.5 text-center text-[13px] outline-none ring-1 ring-amber-400/50"
          />
        ) : (
          <span
            className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-[11px]"
            onDoubleClick={item.type === "memo" ? () => onStartIconEdit(item.id) : undefined}
            title={item.type === "memo" ? t("sidebar.iconDblClick") : undefined}
          >
            {item.type === "folder" ? folderIcon : memoIcon}
          </span>
        )}

        {/* Name / inline rename */}
        {isRenaming ? (
          <input autoFocus value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={commitRename} onKeyDown={handleRenameKey}
            style={item.type === "memo" ? { color: memoTitleHue } : undefined}
            className="min-w-0 flex-1 bg-zinc-800 px-1 text-[11px] outline-none ring-1 ring-cyan-500/40 placeholder:text-zinc-600"
          />
        ) : (
          <span
            className="min-w-0 flex-1 select-none truncate"
            style={item.type === "memo" && !isActiveMemo && !isMultiSelected ? { color: memoTitleHue } : undefined}
            title={displayName}
          >
            {displayName || (
              <span
                className="italic opacity-55"
                style={item.type === "memo" && !isActiveMemo && !isMultiSelected ? { color: memoTitleHue } : undefined}
              >
                {t("sidebar.untitledMemo")}
              </span>
            )}
          </span>
        )}

        {/* Favorite star badge */}
        {item.isBookmarked && (
          <Star size={8} className="shrink-0 fill-amber-400/80 text-amber-400/80" />
        )}

      </div>

      {indPos === "after" && (
        <div className="pointer-events-none mx-1 h-0.5 bg-cyan-400/80 shadow-[0_0_4px_rgba(34,211,238,0.5)]"
          style={{ marginLeft: `${indent + 6}px` }} />
      )}

      {/* Recursive children — always rendered, animated with CSS grid trick */}
      {item.type === "folder" && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          item.isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="overflow-hidden">
            <FileTree
              parentId={item.id} depth={depth + 1}
              currentUserId={currentUserId}
              activeMemoId={activeMemoId} selectedFolderId={selectedFolderId}
              renamingId={renamingId} draggingIds={draggingIds} dropIndicator={dropIndicator}
              mainTreeOrder={mainTreeOrder}
              selectedFileIds={selectedFileIds}
              onRowDragStart={onRowDragStart} onRowDragEnd={onRowDragEnd}
              iconEditingId={iconEditingId} onStartIconEdit={onStartIconEdit} onCommitIconEdit={onCommitIconEdit}
              onSelectMemo={onSelectMemo} onSelectFolder={onSelectFolder} onToggleFolder={onToggleFolder}
              onStartRename={onStartRename} onCommitRename={onCommitRename} onDelete={onDelete}
              onDragOverItem={onDragOverItem} onDragLeaveItem={onDragLeaveItem} onDropOnItem={onDropOnItem}
              onContextMenu={onContextMenu}
              newFolderParentId={rest.newFolderParentId} newFolderName={rest.newFolderName}
              newFolderInputRef={rest.newFolderInputRef}
              onNewFolderChange={rest.onNewFolderChange}
              onNewFolderCommit={rest.onNewFolderCommit} onNewFolderCancel={rest.onNewFolderCancel}
              items={rest.items} memos={memos}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New folder inline input ──────────────────────────────────────────────────

function NewFolderRow({ depth, value, inputRef, onChange, onCommit, onCancel }: {
  depth: number; value: string;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  onChange: (v: string) => void; onCommit: () => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-1 py-[3px] pr-1"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <span className="h-3 w-3 shrink-0" />
      <span className="shrink-0 text-[11px]">📁</span>
      <input ref={inputRef} value={value} placeholder={t("sidebar.folderNamePh")}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          if (e.key === "Escape") onCancel();
        }}
        className="min-w-0 flex-1 bg-zinc-800 px-1 font-mono text-[11px] text-zinc-100 outline-none ring-1 ring-cyan-500/40 placeholder:text-zinc-600"
      />
    </div>
  );
}

// ─── Empty-space context menu (right-click sidebar padding / gutter) ───────────

function SidebarEmptySpaceContextMenu({
  x, y, onClose,
  onAddStandard, onAddMusic, onAddGamedev, onAddFolder,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onAddStandard: () => void;
  onAddMusic: () => void;
  onAddGamedev: () => void;
  onAddFolder: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 6;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  const Row = ({
    icon: Icon, label, onClick,
  }: {
    icon: React.ElementType; label: string; onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-[5px] text-left font-mono text-[11px] tracking-wide text-zinc-200 transition-colors hover:bg-zinc-900 hover:text-zinc-50">
      <Icon size={11} className="shrink-0 opacity-70" />
      {label}
    </button>
  );

  const menu = (
    <div ref={ref}
      className="fixed z-[9999] w-[220px] border border-zinc-800 bg-zinc-950 py-0.5 font-mono shadow-xl shadow-black/60"
      style={{ top: y, left: x }}>
      <p className="px-3 pb-0.5 pt-1 font-mono text-[8px] tracking-wider text-zinc-600">
        {t("sidebar.ctx.emptySpaceHint")}
      </p>
      <Row icon={FileText} label={t("sidebar.ctx.newStandardMemo")} onClick={onAddStandard} />
      <Row icon={Music2} label={t("sidebar.ctx.newMusicMemo")} onClick={onAddMusic} />
      <Row icon={Gamepad2} label={t("sidebar.ctx.newGamedevMemo")} onClick={onAddGamedev} />
      <div className="mx-2 my-0.5 h-px bg-zinc-800/80" />
      <Row icon={FolderPlus} label={t("sidebar.ctx.newFolder")} onClick={onAddFolder} />
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}

// ─── Sidebar context menu ─────────────────────────────────────────────────────

type SidebarMenuProps = {
  item: FileItem;
  activeMemoId: string;
  x: number; y: number;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddMemoInside: (kind: MemoType) => void;
  onAddFolderInside: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onChangeIcon: () => void;
  onExport: () => void;
  onArchive: () => void;
  onShare: () => void;
  onSetMemoType?: (kind: MemoType) => void;
  onSetItemLabelColor: (color: FileItemColor | null, opts?: { skipHistory?: boolean }) => void;
  onMemoColorSliderUndoGestureStart?: () => void;
  onMemoColorSliderUndoGestureEnd?: () => void;
  inviteeMenuMode: InviteeSidebarMenuMode;
};



function SidebarContextMenu(props: SidebarMenuProps) {
  const { item, activeMemoId, x, y, onClose, onRename, onDelete,
    onAddMemoInside, onAddFolderInside,
    onDuplicate, onToggleFavorite, onChangeIcon, onExport, onArchive, onShare,
    onSetMemoType, onSetItemLabelColor,
    onMemoColorSliderUndoGestureStart,
    onMemoColorSliderUndoGestureEnd,
    inviteeMenuMode,
  } = props;
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const isViewerInvitee = item.type === "memo" && inviteeMenuMode === "viewer";
  const isEditorInvitee = item.type === "memo" && inviteeMenuMode === "editor";
  const colorSliderUndoForActiveRow =
    item.type === "memo" &&
    item.id === activeMemoId &&
    !!onMemoColorSliderUndoGestureStart &&
    !!onMemoColorSliderUndoGestureEnd;

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = window.setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { window.clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  const Row = ({
    icon: Icon, label, onClick, danger, muted, active,
  }: {
    icon: React.ElementType; label: string; onClick: () => void;
    danger?: boolean; muted?: boolean; active?: boolean;
  }) => (
    <button type="button" onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-[5px] text-left font-mono text-[11px] tracking-wide transition-colors hover:bg-zinc-900",
        active && "border-l-2 border-cyan-500/50 bg-cyan-950/15",
        danger ? "text-red-400/90 hover:text-red-300"
          : muted ? "text-zinc-600 hover:text-zinc-400"
          : "text-zinc-200 hover:text-zinc-50",
      )}>
      <Icon size={11} className="shrink-0 opacity-70" />
      {label}
    </button>
  );

  const Divider = () => <div className="mx-2 my-0.5 h-px bg-zinc-800/80" />;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 6;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  const menu = (
    <div ref={ref}
      className="fixed z-[9999] w-[220px] border border-zinc-800 bg-zinc-950 py-0.5 font-mono shadow-xl shadow-black/60"
      style={{ top: y, left: x }}>
      {item.type === "folder" ? (
        <>
          <Row icon={FileText} label={t("sidebar.ctx.newStandardMemo")} onClick={() => onAddMemoInside("standard")} />
          <Row icon={Music2} label={t("sidebar.ctx.newMusicMemo")} onClick={() => onAddMemoInside("music")} />
          <Row icon={Gamepad2} label={t("sidebar.ctx.newGamedevMemo")} onClick={() => onAddMemoInside("gamedev")} />
          <Row icon={FolderPlus} label={t("sidebar.ctx.newFolder")} onClick={onAddFolderInside} />
          <Divider />
          <Row
            icon={item.isBookmarked ? StarOff : Star}
            label={item.isBookmarked ? t("sidebar.ctx.removeFavorite") : t("sidebar.ctx.addFavorite")}
            onClick={onToggleFavorite}
          />
          <Divider />
          <Row icon={Pencil}     label={t("sidebar.ctx.rename")}         onClick={onRename} />
          <Divider />
          <RowTintColorPicker
            sectionLabel={t("sidebar.ctx.labelSection")}
            value={fileItemColorToPickerValue(item.color)}
            onChange={(next, opts) => onSetItemLabelColor(next, { skipHistory: opts?.transient })}
            onSliderUndoGestureStart={
              colorSliderUndoForActiveRow ? onMemoColorSliderUndoGestureStart : undefined
            }
            onSliderUndoGestureEnd={colorSliderUndoForActiveRow ? onMemoColorSliderUndoGestureEnd : undefined}
            canClearStored={hasFileItemLabel(item)}
            className="border-t border-zinc-800/40"
          />
          <Divider />
          <Row icon={Trash2}     label={t("sidebar.ctx.delete")}         onClick={onDelete} danger />
        </>
      ) : isViewerInvitee ? (
        <>
          <Row icon={Download} label={t("sidebar.ctx.exportJson")} onClick={onExport} />
          <Row
            icon={item.isBookmarked ? StarOff : Star}
            label={item.isBookmarked ? t("sidebar.ctx.removeFavorite") : t("sidebar.ctx.addFavorite")}
            onClick={onToggleFavorite}
          />
        </>
      ) : isEditorInvitee ? (
        <>
          <Row icon={Download} label={t("sidebar.ctx.exportJson")} onClick={onExport} />
          <Row
            icon={item.isBookmarked ? StarOff : Star}
            label={item.isBookmarked ? t("sidebar.ctx.removeFavorite") : t("sidebar.ctx.addFavorite")}
            onClick={onToggleFavorite}
          />
          <Row icon={Smile} label={t("sidebar.ctx.changeIcon")} onClick={onChangeIcon} />
          <Divider />
          <p className="px-3 pb-0.5 pt-1 font-mono text-[8px] tracking-wider text-zinc-600">{t("sidebar.ctx.changeType")}</p>
          <Row
            icon={FileText}
            label={t("sidebar.ctx.typeStandard")}
            active={(item.memoType ?? "standard") === "standard"}
            onClick={() => onSetMemoType?.("standard")}
          />
          <Row
            icon={Music2}
            label={t("sidebar.ctx.typeMusic")}
            active={item.memoType === "music"}
            onClick={() => onSetMemoType?.("music")}
          />
          <Row
            icon={Gamepad2}
            label={t("sidebar.ctx.typeGamedev")}
            active={item.memoType === "gamedev"}
            onClick={() => onSetMemoType?.("gamedev")}
          />
          <Divider />
          <Row icon={Pencil} label={t("sidebar.ctx.rename")} onClick={onRename} />
          <Divider />
          <RowTintColorPicker
            sectionLabel={t("sidebar.ctx.labelSection")}
            value={fileItemColorToPickerValue(item.color)}
            onChange={(next, opts) => onSetItemLabelColor(next, { skipHistory: opts?.transient })}
            onSliderUndoGestureStart={
              colorSliderUndoForActiveRow ? onMemoColorSliderUndoGestureStart : undefined
            }
            onSliderUndoGestureEnd={colorSliderUndoForActiveRow ? onMemoColorSliderUndoGestureEnd : undefined}
            canClearStored={hasFileItemLabel(item)}
            className="border-t border-zinc-800/40"
          />
        </>
      ) : (
        <>
          <Row icon={Download}  label={t("sidebar.ctx.exportJson")}  onClick={onExport} />
          <Row
            icon={item.isBookmarked ? StarOff : Star}
            label={item.isBookmarked ? t("sidebar.ctx.removeFavorite") : t("sidebar.ctx.addFavorite")}
            onClick={onToggleFavorite}
          />
          <Row icon={Copy}      label={t("sidebar.ctx.duplicate")}    onClick={onDuplicate} />
          <Row icon={Share2}    label={t("sidebar.ctx.share")}       onClick={onShare} />
          <Row icon={Smile}     label={t("sidebar.ctx.changeIcon")}    onClick={onChangeIcon} />
          <Divider />
          <p className="px-3 pb-0.5 pt-1 font-mono text-[8px] tracking-wider text-zinc-600">{t("sidebar.ctx.changeType")}</p>
          <Row
            icon={FileText}
            label={t("sidebar.ctx.typeStandard")}
            active={(item.memoType ?? "standard") === "standard"}
            onClick={() => onSetMemoType?.("standard")}
          />
          <Row
            icon={Music2}
            label={t("sidebar.ctx.typeMusic")}
            active={item.memoType === "music"}
            onClick={() => onSetMemoType?.("music")}
          />
          <Row
            icon={Gamepad2}
            label={t("sidebar.ctx.typeGamedev")}
            active={item.memoType === "gamedev"}
            onClick={() => onSetMemoType?.("gamedev")}
          />
          <Divider />
          <Row icon={Pencil}    label={t("sidebar.ctx.rename")}         onClick={onRename} />
          <Divider />
          <RowTintColorPicker
            sectionLabel={t("sidebar.ctx.labelSection")}
            value={fileItemColorToPickerValue(item.color)}
            onChange={(next, opts) => onSetItemLabelColor(next, { skipHistory: opts?.transient })}
            onSliderUndoGestureStart={
              colorSliderUndoForActiveRow ? onMemoColorSliderUndoGestureStart : undefined
            }
            onSliderUndoGestureEnd={colorSliderUndoForActiveRow ? onMemoColorSliderUndoGestureEnd : undefined}
            canClearStored={hasFileItemLabel(item)}
            className="border-t border-zinc-800/40"
          />
          <Divider />
          <Row icon={Trash2}    label={t("sidebar.ctx.delete")}         onClick={onDelete} danger />
          <Divider />
          <Row icon={Archive}   label={t("sidebar.ctx.archive")}        onClick={onArchive} muted />
        </>
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteConfirmDialog({
  item, displayName, onConfirm, onCancel,
}: {
  item: FileItem;
  displayName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const isFolder = item.type === "folder";

  // Close on Escape
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/72 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="relative w-[340px] border border-zinc-700/80 bg-zinc-950 p-5 font-mono shadow-2xl shadow-black/80">
        {/* Corner accents */}
        <div className="pointer-events-none absolute -left-px -top-px h-4 w-4 border-l-2 border-t-2 border-red-500/40" />
        <div className="pointer-events-none absolute -right-px -top-px h-4 w-4 border-r-2 border-t-2 border-red-500/40" />
        <div className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-red-500/40" />
        <div className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-red-500/40" />

        <div className="mb-4">
          <h3 className="mb-1 text-[13px] font-semibold tracking-wide text-zinc-100">
            {t("sidebar.delete.title").replace("{name}", displayName)}
          </h3>

          {isFolder ? (
            <div className="mt-2 border border-red-900/50 bg-red-950/20 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-red-400/90">
                {t("sidebar.delete.folderWarn")}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-zinc-500">
              {t("sidebar.delete.memoWarn")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="border border-zinc-700 px-4 py-1.5 text-[11px] tracking-wide text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
            {t("sidebar.delete.cancel")}
          </button>
          <button type="button" onClick={onConfirm}
            className="border border-red-800 bg-red-950/60 px-4 py-1.5 text-[11px] tracking-wide text-red-300 transition-colors hover:bg-red-900/60 hover:text-red-200">
            {t("sidebar.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
