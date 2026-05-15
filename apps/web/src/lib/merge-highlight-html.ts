/** Escape text for HTML; highlight merge tags and unsubscribe tokens as pills (mirror under transparent inputs). */
export function mergeFieldTextToHighlightedHtml(raw: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\u00a0/g, " ");

  const re = /\{\{LG_UNSUB:([^}]*)\}\}|\{\{([^{}]{1,80})\}\}/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out += esc(raw.slice(last, m.index));
    if (m[1] !== undefined) {
      const anchor = (m[1] ?? "").trim() || "Unsubscribe";
      out += `<span class="merge-hl-unsub-pill align-middle" title="Unsubscribe link: ${esc(anchor)}">${esc(m[0])}</span>`;
    } else {
      out += `<span class="merge-hl-pill align-middle">${esc(m[0])}</span>`;
    }
    last = m.index + m[0].length;
  }
  out += esc(raw.slice(last));
  return out || "&nbsp;";
}
