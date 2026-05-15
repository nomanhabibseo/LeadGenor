import { Logger } from '@nestjs/common';

const log = new Logger('EmailSchedulers');

/**
 * Campaign send + reply-detection intervals hammer Prisma (and IMAP). With Supabase `connection_limit=1`
 * this starves `/users/me` and triggers proxy `ECONNRESET` (see dev terminal).
 *
 * Off by default when API is started via `npm run start:dev` / `npm run start:debug`
 * (`npm_lifecycle_event`). Enable locally with `ENABLE_EMAIL_SCHEDULERS_IN_DEV=1`.
 *
 * Direct `nest start --watch` leaves schedulers on (no npm lifecycle).
 */
let warnedSchedulersOff = false;

export function heavyEmailSchedulersEnabled(): boolean {
  if (/^1|true$/i.test((process.env.ENABLE_EMAIL_SCHEDULERS_IN_DEV ?? "").trim())) return true;
  const ev = process.env.npm_lifecycle_event ?? "";
  if (ev === "start:dev" || ev === "start:debug") {
    if (!warnedSchedulersOff) {
      warnedSchedulersOff = true;
      log.log('Campaign/reply schedulers OFF (npm start:dev). Set ENABLE_EMAIL_SCHEDULERS_IN_DEV=1 to enable.');
    }
    return false;
  }
  return true;
}
