/** localStorage + cookie name (must match server layout + inline script). */
export const THEME_STORAGE_KEY = "leadgenor-theme";

export type ThemePreference = "light" | "dark" | "system";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Client-only: persist theme for SSR on next request. */
export function setThemeCookieClient(value: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_STORAGE_KEY}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolve stored preference to applied dark boolean. */
export function resolveThemeDark(pref: ThemePreference | string | null): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return systemPrefersDark();
}

/**
 * Runs first in `<body>`: reads localStorage + system preference, sets `html.dark`
 * and `color-scheme`, mirrors explicit light/dark choice to cookie so the server can SSR the right class.
 */
export function getThemeBootstrapScript(): string {
  return `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var dark=false;if(s==="dark")dark=true;else if(s==="light")dark=false;else dark=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.classList.toggle("dark",dark);r.style.colorScheme=dark?"dark":"light";var c=s==="dark"||s==="light"?s:(dark?"dark":"light");document.cookie=k+"="+c+"; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax"}catch(e){}})();`;
}
