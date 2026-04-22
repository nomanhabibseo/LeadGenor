/** Placeholder href in legacy template HTML; replaced per recipient at send time. Must match web `email-template-unsub.ts`. */
export const INLINE_UNSUBSCRIBE_HREF = '__LG_UNSUB_URL__';

/** Stored in template body; expanded to `<a href="…">…</a>` at send time. Must match web `LG_UNSUB_TOKEN_RE`. */
export const LG_UNSUB_TOKEN_RE = /\{\{LG_UNSUB:([^}]*)\}\}/g;

function escHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Replace `{{LG_UNSUB:anchor}}` with a real unsubscribe link (anchor text is plain, not merge-processed). */
export function expandLgUnsubTokensToAnchor(body: string, unsubscribeUrl: string): string {
  LG_UNSUB_TOKEN_RE.lastIndex = 0;
  return body.replace(LG_UNSUB_TOKEN_RE, (_, anchor: string) => {
    const text = String(anchor ?? '')
      .replace(/</g, '')
      .replace(/>/g, '')
      .trim();
    const label = text || 'Unsubscribe';
    return `<a href="${escHtmlAttr(unsubscribeUrl)}">${escHtmlText(label)}</a>`;
  });
}

export function bodyHasInlineUnsubscribe(mergedBody: string): boolean {
  return mergedBody.includes(INLINE_UNSUBSCRIBE_HREF) || /\{\{LG_UNSUB:[^}]*\}\}/.test(mergedBody);
}
