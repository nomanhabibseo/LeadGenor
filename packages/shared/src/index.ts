import { z } from "zod";

/** Normalize URL for duplicate detection: lowercase host, strip trailing slash, strip www. */
export function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `https://${host}${path}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
}

export const tatUnitSchema = z.enum(["HOURS", "DAYS"]);
export type TatUnit = z.infer<typeof tatUnitSchema>;

export const dealStatusSchema = z.enum(["DEAL_DONE", "PENDING"]);
export const paymentTermsSchema = z.enum(["ADVANCE", "AFTER_LIVE_LINK"]);
export const linkTypeSchema = z.enum(["GUEST_POST", "NICHE_EDIT"]);
export const orderStatusSchema = z.enum(["COMPLETED", "PENDING"]);
