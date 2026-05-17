import type { MemoType } from "@/types/memoKind";
import { GAMEDEV_STAGES } from "@/types/gamedev";
import { MEMO_WORKFLOW_STATUSES } from "@/types/memoWorkflow";

/** Keys drive which blocks render inside the unified memo status dropdown. */
export type MemoStatusMenuSectionKey = "workflow" | "gamedev";

/** Workflow status options (all memo kinds) — only item in the top-right menu for non-gamedev. */
export const WORKFLOW_STATUS_OPTIONS = MEMO_WORKFLOW_STATUSES;

/** Game-dev pipeline (gamedev memos only; music release lives in the music toolbar). */
export const GAMEDEV_STAGE_OPTIONS = GAMEDEV_STAGES;

export function getMemoStatusMenuSectionKeys(memoType: MemoType): MemoStatusMenuSectionKey[] {
  const keys: MemoStatusMenuSectionKey[] = ["workflow"];
  if (memoType === "gamedev") keys.push("gamedev");
  return keys;
}
