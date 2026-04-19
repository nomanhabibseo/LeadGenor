export { default } from "next-auth/middleware";

/** Only dashboard app routes — never `/_next`, `/`, `/login`, or files in `public/`. */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/vendors/:path*",
    "/clients/:path*",
    "/orders/:path*",
    "/revenue/:path*",
    "/trash/:path*",
    "/settings/:path*",
  ],
};
