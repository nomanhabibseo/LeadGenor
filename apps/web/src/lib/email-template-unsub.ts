/** Legacy placeholder href in HTML snippets; still expanded at send time. Must match API `inline-unsub-placeholder.ts`. */
export const INLINE_UNSUBSCRIBE_HREF = "__LG_UNSUB_URL__";

/** Stored in template body; expanded at send. Must match API `LG_UNSUB_TOKEN_RE`. */
export const LG_UNSUB_TOKEN_RE = /\{\{LG_UNSUB:([^}]*)\}\}/g;

export function hasInlineUnsubscribeInBody(body: string): boolean {
  return body.includes(INLINE_UNSUBSCRIBE_HREF) || /\{\{LG_UNSUB:[^}]*\}\}/.test(body);
}

/** Insert token (shown as an “unsubscribe” pill in the editor, expanded to a real link when sending). */
export function buildInlineUnsubscribeAnchorSnippet(anchorText: string): string {
  const t = anchorText.replace(/}/g, "").replace(/</g, "").replace(/>/g, "").trim() || "Unsubscribe";
  return `{{LG_UNSUB:${t}}}`;
}

/** Normalize legacy stored HTML to token when loading in the editor. */
export function migrateLegacyInlineUnsubHtmlToToken(body: string): string {
  return body.replace(
    /<a\s+[^>]*href=["']__LG_UNSUB_URL__["'][^>]*>([^<]*)<\/a>/gi,
    (_, inner: string) => `{{LG_UNSUB:${String(inner).replace(/}/g, "").replace(/</g, "").replace(/>/g, "").trim() || "Unsubscribe"}}}`,
  );
}

/** After merge preview, show a fake link for `{{LG_UNSUB:…}}` in HTML preview. */
export function expandLgUnsubTokensForPreviewMerged(html: string): string {
  return html.replace(/\{\{LG_UNSUB:([^}]*)\}\}/g, (_, anchor: string) => {
    const text = String(anchor ?? "")
      .replace(/</g, "")
      .replace(/>/g, "")
      .trim() || "Unsubscribe";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<a href="#" style="color:#2563eb;text-decoration:underline">${esc(text)}</a>`;
  });
}
