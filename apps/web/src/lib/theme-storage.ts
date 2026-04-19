/** localStorage + cookie name (must match server layout + inline script). */
export const THEME_STORAGE_KEY = "leadgenor-theme";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Client-only: persist theme for SSR on next request. */
export function setThemeCookieClient(value: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_STORAGE_KEY}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Runs first in `<body>`: reads localStorage + system preference, sets `html.dark`
 * and `color-scheme`, mirrors explicit choice to cookie so the server can SSR the right class.
 */
export function getThemeBootstrapScript(): string {
  return `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var dark=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);r.style.colorScheme=dark?"dark":"light";if(s==="dark"||s==="light"){document.cookie=k+"="+s+"; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax"}}catch(e){}})();`;
}
