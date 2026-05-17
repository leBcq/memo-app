/** Shared memo progress (all memo kinds), persisted on `FileItem.workflowStatus`. */
export type MemoWorkflowStatus = "DRAFT" | "WIP" | "DONE";

export const MEMO_WORKFLOW_STATUSES: MemoWorkflowStatus[] = ["DRAFT", "WIP", "DONE"];

export const MEMO_WORKFLOW_LABEL: Record<MemoWorkflowStatus, string> = {
  DRAFT: "DRAFT",
  WIP: "WIP",
  DONE: "DONE",
};

/** Hex / CSS color for badge borders and text. */
export const MEMO_WORKFLOW_COLORS: Record<MemoWorkflowStatus, string> = {
  DRAFT: "#71717a",
  WIP: "#3b82f6",
  DONE: "#22c55e",
};

export function normalizeMemoWorkflowStatus(raw: unknown): MemoWorkflowStatus {
  if (raw === "WIP" || raw === "DONE" || raw === "DRAFT") return raw;
  return "DRAFT";
}
