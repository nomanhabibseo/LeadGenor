"use strict";

/**
 * prisma generate pulls schema env vars. Frontend-only installs (e.g. Vercel `@leadgenor/web`)
 * often omit DATABASE_URL/DIRECT_URL — skip generate rather than failing the whole npm ci.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const dbRoot = path.join(__dirname, "..");

function hasUrls() {
  return Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DIRECT_URL?.trim());
}

if (!hasUrls()) {
  console.warn(
    "[@leadgenor/db] Skipping prisma generate (DATABASE_URL and/or DIRECT_URL unset). Needed for Nest; OK for frontend-only CI.",
  );
  process.exit(0);
}

const r = spawnSync("npx", ["prisma", "generate"], {
  cwd: dbRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(typeof r.status === "number" ? r.status : 1);
