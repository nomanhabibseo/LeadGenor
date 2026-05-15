import { DealStatus } from '@prisma/client';

/** Normalize cell text for deal-status matching (import spreadsheets). */
function tokenizeDealStatus(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

const DEAL_DONE_TOKENS = new Set([
  'done',
  'dealdone',
  'deal_done',
  'complete',
  'completed',
  'closed',
  'finished',
  'yes',
  'y',
]);

/**
 * Map “Deal Status” column values (done / pending) to `DealStatus`.
 * Empty or unrecognized values default to PENDING.
 */
export function parseVendorDealStatusFromImport(raw: string | undefined | null): DealStatus {
  const t = tokenizeDealStatus(String(raw ?? ''));
  if (!t) return DealStatus.PENDING;
  if (DEAL_DONE_TOKENS.has(t)) return DealStatus.DEAL_DONE;
  return DealStatus.PENDING;
}
