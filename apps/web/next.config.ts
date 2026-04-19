import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Monorepo root — only needed for production output tracing; omit in dev to avoid odd resolution on some Windows setups. */
  ...(process.env.NODE_ENV === "production"
    ? { outputFileTracingRoot: path.join(__dirname, "..", "..") }
    : {}),
};

export default nextConfig;
