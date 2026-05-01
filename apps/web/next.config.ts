import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const devNestOrigin =
  (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

/** Same-origin rewrite — path segment must match `NEXT_DEV_API_PROXY_SEGMENT` in `src/lib/api.ts`. */
const LG_DEV_API_PROXY = "/lg-api-proxy";

const nextConfig: NextConfig = {
  /** Monorepo root — only needed for production output tracing; omit in dev to avoid odd resolution on some Windows setups. */
  ...(process.env.NODE_ENV === "production"
    ? { outputFileTracingRoot: path.join(__dirname, "..", "..") }
    : {}),
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: `${LG_DEV_API_PROXY}/:path*`,
        destination: `${devNestOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
