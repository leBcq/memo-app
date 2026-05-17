import type { FormatCommand } from "@/hooks/useTextFormatting";

/** Body editor for a standard note row (not plugin/spec cards). */
export function getNoteBodyEditor(nodeId: string): HTMLElement | null {
  const wrap = document.querySelector<HTMLElement>(`[data-node-id="${cssEscapeAttr(nodeId)}"]`);
  if (!wrap) return null;
  const el = wrap.querySelector<HTMLElement>('[data-geo-editor="body"]');
  if (!el || el.getAttribute("contenteditable") !== "true") return null;
  return el;
}

function cssEscapeAttr(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/["\\]/g, "\\$&");
}

function selectAllContents(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel) return false;
  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

export function applyExecCommandWholeBody(el: HTMLElement, command: string, value?: string | null) {
  if (!selectAllContents(el)) return;
  document.execCommand(command, false, value ?? undefined);
}

/** Bold / italic / underline / strikeThrough on entire body. */
export function applyFormatWholeBodies(nodeIds: string[], cmd: FormatCommand) {
  for (const id of nodeIds) {
    const el = getNoteBodyEditor(id);
    if (!el) continue;
    el.focus();
    applyExecCommandWholeBody(el, cmd);
  }
}

export function applyForeColorWholeBodies(nodeIds: string[], hex: string) {
  for (const id of nodeIds) {
    const el = getNoteBodyEditor(id);
    if (!el) continue;
    el.focus();
    applyExecCommandWholeBody(el, "foreColor", hex);
  }
}

export function applyHiliteWholeBodies(nodeIds: string[], color: string | null) {
  for (const id of nodeIds) {
    const el = getNoteBodyEditor(id);
    if (!el) continue;
    el.focus();
    applyExecCommandWholeBody(el, "hiliteColor", color ?? "transparent");
  }
}

/** Mirrors {@link useTextFormatting} fontSize wrapping for a non-collapsed range (whole body). */
export function applyFontSizeWholeBody(el: HTMLElement, size: number) {
  if (!selectAllContents(el)) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const fragment = range.extractContents();
  const span = document.createElement("span");
  span.style.fontSize = `${size}px`;
  span.appendChild(fragment);
  range.insertNode(span);
  span.parentElement?.normalize();

  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

export function applyFontSizeWholeBodies(nodeIds: string[], size: number) {
  for (const id of nodeIds) {
    const el = getNoteBodyEditor(id);
    if (!el) continue;
    el.focus();
    applyFontSizeWholeBody(el, size);
  }
}

export function collectBodyHtmlPatches(nodeIds: string[]): Record<string, string> {
  const patches: Record<string, string> = {};
  for (const id of nodeIds) {
    const el = getNoteBodyEditor(id);
    if (el) patches[id] = el.innerHTML;
  }
  return patches;
}
