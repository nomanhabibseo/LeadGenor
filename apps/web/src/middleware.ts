import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Incoming request header set on every middleware `next()` so RSC layouts can build a safe
 * `/login?callbackUrl=…` fallback (defense-in-depth if Edge token read ever diverges from Node).
 */
const CALLBACK_HEADER = "x-lg-callback-url";

function forwardWithCallback(request: NextRequest): NextResponse {
  const callback = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CALLBACK_HEADER, callback);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/** Never gate NextAuth, RSC payloads, or static assets — fixes blank/404 app when session fetch is redirected. */
function isAlwaysPublic(pathname: string) {
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(?:ico|png|jpg|jpeg|svg|webp|gif|txt|xml|json|webmanifest|woff2?)$/i.test(pathname)) return true;
  return false;
}

/**
 * Routes that stay reachable without a session. Everything else requires auth
 * (deep links to vendors, clients, orders, email-marketing, etc. → /login?callbackUrl=…).
 */
const PUBLIC_PATHS_EXACT = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/pricing",
  "/privacy",
  "/terms-conditions",
  "/contact",
]);

const PUBLIC_PATH_PREFIXES = ["/blogs"];

function isPublicRoute(pathname: string) {
  if (PUBLIC_PATHS_EXACT.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host")?.toLowerCase();

  /** Browsers request `/favicon.ico` implicitly; rewrite to PNG so the tab icon matches `LeadGenor-site-icon.png`. */
  if (pathname === "/favicon.ico") {
    const u = request.nextUrl.clone();
    u.pathname = "/LeadGenor-site-icon.png";
    const res = NextResponse.rewrite(u);
    res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return res;
  }

  // Enforce canonical apex domain in production.
  if (host === "www.leadgenor.com") {
    const target = new URL(request.url);
    target.hostname = "leadgenor.com";
    return NextResponse.redirect(target, 308);
  }

  if (isAlwaysPublic(pathname)) {
    return forwardWithCallback(request);
  }
  if (isPublicRoute(pathname)) {
    return forwardWithCallback(request);
  }

  const secret = process.env.NEXTAUTH_SECRET;
  /** Align session cookie name with the actual TLS hop (NextAuth defaults use NEXTAUTH_URL / VERCEL, which can disagree in dev/staging). */
  const secureCookie = request.nextUrl.protocol === "https:";
  const token = secret ? await getToken({ req: request, secret, secureCookie }) : null;

  if (!secret) {
    console.error("[middleware] NEXTAUTH_SECRET is not set; gated routes redirect to login (token cannot be validated).");
  }

  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return forwardWithCallback(request);
}

export const config = {
  matcher: [
    "/favicon.ico",
    /*
     * Run on app navigations — exclude static chunks, images, and files with extensions.
     * `/favicon.ico` is matched above so middleware can rewrite it to PNG.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
