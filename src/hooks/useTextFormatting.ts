import type { MutableRefObject } from "react";

export type FormatCommand = "bold" | "italic" | "underline" | "strikeThrough";

export function useTextFormatting(
  savedRangeRef?: MutableRefObject<Range | null>,
) {
  /**
   * Restore the saved selection so execCommand / DOM operations always have a
   * valid range to work with, even after a floating menu has received pointer
   * events. Returns true when a range was successfully restored.
   */
  const restoreSelection = (): boolean => {
    const range = savedRangeRef?.current;
    if (!range) return false;
    try {
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  /** After any DOM mutation, snapshot the (potentially updated) selection. */
  const saveSelection = () => {
    if (!savedRangeRef) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  // ── Bold / italic / underline / strikethrough ─────────────────────────────

  const applyFormat = (cmd: FormatCommand) => {
    restoreSelection();
    document.execCommand(cmd, false, undefined);
    saveSelection();
  };

  // ── Font size — pure span-wrapping, no execCommand('fontSize') ───────────
  //
  // execCommand('fontSize', false, '7') briefly inserts <font size="7"> which
  // browsers render as an enormous legacy font size before we can replace it.
  // Instead we directly manipulate the DOM range to wrap the selection in a
  // <span style="font-size: Xpx">.

  const applyFontSize = (size: number) => {
    restoreSelection();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return; // Nothing to style

    // Extract the selected fragment (removes it from the DOM temporarily)
    const fragment = range.extractContents();

    // Wrap it in a fresh span
    const span = document.createElement("span");
    span.style.fontSize = `${size}px`;
    span.appendChild(fragment);

    // Re-insert at the original position
    range.insertNode(span);

    // Normalize the parent to merge adjacent text nodes created by the above
    span.parentElement?.normalize();

    // Restore selection to the full content of the new span
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);

    if (savedRangeRef) savedRangeRef.current = newRange.cloneRange();
  };

  // ── Text color ────────────────────────────────────────────────────────────

  const applyFontColor = (hex: string) => {
    restoreSelection();
    document.execCommand("foreColor", false, hex);
    saveSelection();
  };

  // ── Highlight (inline background-color) ──────────────────────────────────

  const applyHighlightColor = (color: string | null) => {
    restoreSelection();
    document.execCommand("hiliteColor", false, color ?? "transparent");
    saveSelection();
  };

  return { applyFormat, applyFontSize, applyFontColor, applyHighlightColor };
}
