/** Music memo: rough lyric length — plain text with all Unicode whitespace stripped. */

const STRIP_TAGS = /<[^>]*>/g;

export function musicLyricNonWhitespaceCountFromHtml(html: string): number {
  let text: string;
  if (typeof document === "undefined") {
    text = html.replace(STRIP_TAGS, "");
  } else {
    const el = document.createElement("div");
    el.innerHTML = html;
    text = el.textContent ?? "";
  }
  return text.replace(/\s/g, "").length;
}

export function musicLyricNonWhitespaceCountFromElement(el: HTMLElement): number {
  return (el.textContent ?? "").replace(/\s/g, "").length;
}
