/**
 * Bump `LOGO_ASSET_REVISION` when replacing `apps/web/public/LeadGenor-logo.png`.
 * Included on `LOGO_PATH` so header/footer/sidebar bypass stale browser cache.
 */
export const LOGO_ASSET_REVISION = "5";

/**
 * Query string busts CDN/browser cache while the file stays `LeadGenor-logo.png` on disk.
 * `BrandMark` / footer use `unoptimized` so this hits `public/` directly (no stale `/_next/image`).
 */
export const LOGO_PATH = `/LeadGenor-logo.png?v=${LOGO_ASSET_REVISION}`;

/**
 * Square brand mark for tab / bookmarks only (`public/LeadGenor-site-icon.png`).
 * Also copied to `src/app/icon.png` + `apple-icon.png` (Next.js file convention — primary for the tab icon).
 * Bump `SITE_ICON_REVISION` when replacing the PNG.
 */
export const SITE_ICON_REVISION = "3";
export const FAVICON_PATH = `/LeadGenor-site-icon.png?v=${SITE_ICON_REVISION}`;
