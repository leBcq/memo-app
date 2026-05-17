import type { MemoType } from "@/types/memoKind";
import type { MemoWorkflowStatus } from "@/types/memoWorkflow";

export type FileItemLabelColor =
  | "default"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "gray";

/** Saved on `FileItem.color` — named preset or CSS string (#rgb…, #rrggbbaa, rgba()) */
export type FileItemLabelPreset = Exclude<FileItemLabelColor, "default">;
export type FileItemColor = FileItemLabelPreset | string;

export type FileItem = {
  id: string;
  type: "folder" | "memo";
  /** Folder display name. For memos this is kept in sync with Memo.title. */
  name: string;
  /** null = root level */
  parentId: string | null;
  /** Whether this folder is expanded (irrelevant for memos) */
  isOpen: boolean;
  /** Sort order within the same parent */
  order: number;
  /** Starred / bookmarked flag */
  isBookmarked?: boolean;
  /** Custom emoji icon for memos (e.g. "🎵", "📝") */
  icon?: string;
  /** When type === "memo": logical memo kind (standard / music / gamedev). */
  memoType?: MemoType;
  /** Sidebar color label: preset key and/or custom hex/rgba from the picker. */
  color?: FileItemColor;
  /** Progress flag for memos (DRAFT / WIP / DONE). Omitted = DRAFT. */
  workflowStatus?: MemoWorkflowStatus;
};
