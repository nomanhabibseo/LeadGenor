/**
 * Heuristics for "this inbound message is probably a reply to our outreach",
 * to avoid marking campaign recipients as replied on unrelated mail (newsletters,
 * first-contact cold emails, etc.).
 */

const REPLY_SUBJECT_PREFIX =
  /^\s*(re|aw|vs|sv|antw|antwort|reply|res|fw|fwd|wg|tr|odp|sv\s*:|re\s*:|aw\s*:)\s*[:\s\[]/i;

/** Subject line often indicates a reply / forward thread. */
export function subjectSuggestsReply(subject: string): boolean {
  const s = subject.trim();
  if (!s) return false;
  if (REPLY_SUBJECT_PREFIX.test(s)) return true;
  if (/\bre\s*:\s*/i.test(s) && s.length < 500) return true;
  return false;
}

export function hasThreadingHeaders(inReplyTo?: string | null, references?: string | null): boolean {
  const ir = (inReplyTo ?? '').trim();
  if (ir.length > 3) return true;
  const ref = (references ?? '').trim();
  if (ref.length > 3) return true;
  return false;
}

export function isLikelyReplyToPriorOutbound(msg: {
  subject: string;
  inReplyTo?: string | null;
  references?: string | null;
}): boolean {
  if (hasThreadingHeaders(msg.inReplyTo, msg.references)) return true;
  return subjectSuggestsReply(msg.subject);
}
