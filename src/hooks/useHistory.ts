/**
 * Pure functional helpers for a per-key undo/redo stack.
 * No React dependencies — usable in any context.
 */

export const HISTORY_MAX = 50;

export type HistoryStack<T> = {
  readonly past: T[];   // index 0 = oldest, last = most recent
  readonly future: T[]; // index 0 = next on redo, last = furthest
};

export function createStack<T>(): HistoryStack<T> {
  return { past: [], future: [] };
}

/**
 * Push `snapshot` (the state BEFORE the upcoming change) onto the past stack
 * and clear the future (any redo chain is invalidated by a new action).
 */
export function stackRecord<T>(stack: HistoryStack<T>, snapshot: T): HistoryStack<T> {
  return {
    past: [...stack.past.slice(-(HISTORY_MAX - 1)), snapshot],
    future: [],
  };
}

/**
 * Undo: pop the most-recent past entry and push `current` onto the future.
 * Returns the state to restore, or null if there is nothing to undo.
 */
export function stackUndo<T>(
  stack: HistoryStack<T>,
  current: T,
): { next: HistoryStack<T>; restored: T } | null {
  if (stack.past.length === 0) return null;
  const restored = stack.past[stack.past.length - 1];
  return {
    next: {
      past: stack.past.slice(0, -1),
      future: [current, ...stack.future],
    },
    restored,
  };
}

/**
 * Redo: pop the first future entry and push `current` onto the past.
 * Returns the state to restore, or null if there is nothing to redo.
 */
export function stackRedo<T>(
  stack: HistoryStack<T>,
  current: T,
): { next: HistoryStack<T>; restored: T } | null {
  if (stack.future.length === 0) return null;
  const restored = stack.future[0];
  return {
    next: {
      past: [...stack.past, current],
      future: stack.future.slice(1),
    },
    restored,
  };
}
