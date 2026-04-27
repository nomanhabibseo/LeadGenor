import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Never gate NextAuth, RSC payloads, or static assets — fixes blank/404 app when session fetch is redirected. */
function isAlwaysPublic(pathname: string) {
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(?:ico|png|jpg|jpeg|svg|webp|gif|txt|xml|json|webmanifest|woff2?)$/i.test(pathname)) return true;
  return false;
}

const PUBLIC_EXACT = new Set(["/", "/login", "/register", "/forgot-password"]);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/vendors",
  "/clients",
  "/orders",
  "/revenue",
  "/trash",
  "/settings",
  "/email-marketing",
  "/reports",
  "/notifications",
];

function needsAuth(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isAlwaysPublic(pathname)) {
    return NextResponse.next();
  }
  if (PUBLIC_EXACT.has(pathname)) {
    return NextResponse.next();
  }
  if (!needsAuth(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[middleware] NEXTAUTH_SECRET is not set; allowing request through.");
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret });
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on app HTML navigations only — exclude static chunks, images, and files with extensions.
     * (Same idea as Next.js + next-auth docs; avoids breaking `/_next/static/*`.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
