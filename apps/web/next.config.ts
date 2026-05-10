import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function devNestApiOrigin(): string {
  const raw = (
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    if (u.hostname === "localhost") u.hostname = "127.0.0.1";
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw.includes("://") ? raw : `http://${raw}`;
  }
}

const devNestOrigin = devNestApiOrigin();

/** Same-origin rewrite — path segment must match `NEXT_DEV_API_PROXY_SEGMENT` in `src/lib/api.ts`. */
const LG_DEV_API_PROXY = "/lg-api-proxy";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    /**
     * Dev rewrites (`/lg-api-proxy` → Nest) use an HTTP proxy with a default limit (~30–60s).
     * Long Google Sheet imports need a higher limit or the browser gets 5xx while the API still runs.
     * @see https://github.com/vercel/next.js/discussions/36598
     */
    proxyTimeout: 600_000,
  },
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
