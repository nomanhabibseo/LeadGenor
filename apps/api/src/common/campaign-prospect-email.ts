/** Parse list item `emails` JSON into raw string cells (import often stores plain strings only). */
export function prospectEmailCellsFromImport(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

/**
 * Validates a spreadsheet-style email cell for outbound campaign recipients.
 * Returns English reason when the value must not receive mail; null when OK.
 */
export function campaignProspectEmailRejection(trimmedBeforeCaseCheck: string): string | null {
  const trimmed = trimmedBeforeCaseCheck.trim();
  if (!trimmed) {
    return 'No usable email — this cell is empty or whitespace only.';
  }
  if (trimmed.length > 254) {
    return 'No usable email — address is longer than permitted.';
  }
  if (/\s/.test(trimmed)) {
    return 'No usable email — multiple tokens or spaces; expected a single email address.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed)) {
    return 'No usable email — value is not a valid email format.';
  }
  return null;
}
