"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

type OauthConfig = { google: boolean; microsoft: boolean };

export default function EmailAccountAddChooserPage() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const [lastError, setLastError] = useState<string | null>(null);

  const { data: oauthCfg } = useQuery({
    queryKey: ["oauth-config", userKey],
    queryFn: () => apiFetch<OauthConfig>("/email-marketing/oauth/config", token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  async function startGoogle() {
    if (!token) return;
    setLastError(null);
    const r = await apiFetch<{ url?: string; error?: string }>("/email-marketing/oauth/google/url", token);
    if (r.url) window.location.href = r.url;
    else setLastError(r.error ?? "Gmail OAuth is not configured.");
  }

  async function startOutlook() {
    if (!token) return;
    setLastError(null);
    const r = await apiFetch<{ url?: string; error?: string }>("/email-marketing/oauth/microsoft/url", token);
    if (r.url) window.location.href = r.url;
    else setLastError(r.error ?? "Microsoft OAuth is not configured.");
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-slate-600 dark:text-slate-400">Loading…</div>
    );
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Please sign in to add an account.</p>
        <Link href="/login" className="mt-4 inline-block text-cyan-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  const apiDisplay = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

  return (
    <div className="mx-auto max-w-lg space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Add email account</h1>
      </div>

      {lastError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">{lastError}</p>
          <p className="mt-2 text-xs opacity-90">
            Set the variables below in your <strong>API</strong> environment (repo root <code className="rounded bg-black/10 px-1">.env</code> or{" "}
            <code className="rounded bg-black/10 px-1">apps/api/.env</code>), then restart <code className="rounded bg-black/10 px-1">npm run dev</code>.
          </p>
        </div>
      ) : null}

      {oauthCfg && (!oauthCfg.google || !oauthCfg.microsoft) ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/55 dark:text-slate-200">
          <p className="font-semibold text-slate-900 dark:text-white">OAuth server setup</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            The browser talks to the Next app, but OAuth secrets live on the Nest API at{" "}
            <span className="font-mono text-cyan-700 dark:text-cyan-300">{apiDisplay}</span>. Add non-empty values and
            restart the API process.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-xs">
            {!oauthCfg.google ? (
              <li>
                <strong>Google:</strong> <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code>,{" "}
                <code className="font-mono">GOOGLE_OAUTH_CLIENT_SECRET</code>,{" "}
                <code className="font-mono">GOOGLE_OAUTH_REDIRECT_URI</code> (must match Google Cloud Console redirect,
                e.g. <code className="font-mono">{apiDisplay}/email-marketing/oauth/google/callback</code>)
              </li>
            ) : null}
            {!oauthCfg.microsoft ? (
              <li>
                <strong>Microsoft:</strong> <code className="font-mono">MICROSOFT_OAUTH_CLIENT_ID</code>,{" "}
                <code className="font-mono">MICROSOFT_OAUTH_CLIENT_SECRET</code>,{" "}
                <code className="font-mono">MICROSOFT_OAUTH_REDIRECT_URI</code> (Azure redirect URI, e.g.{" "}
                <code className="font-mono">{apiDisplay}/email-marketing/oauth/microsoft/callback</code>)
              </li>
            ) : null}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            See <code className="rounded bg-white/80 px-1 dark:bg-slate-800">.env.example</code> at the repo root for a full list including{" "}
            <code className="font-mono">WEB_ORIGIN</code> and <code className="font-mono">ENCRYPTION_KEY</code>.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          disabled={oauthCfg && !oauthCfg.google}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/65 dark:hover:border-cyan-500/40"
          title={oauthCfg && !oauthCfg.google ? "Configure Google OAuth env on the API first" : undefined}
          onClick={() => void startGoogle()}
        >
          <Mail className="h-8 w-8 shrink-0 text-red-500" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">Gmail</div>
            <div className="text-xs text-slate-500">Google account — OAuth</div>
          </div>
        </button>
        <button
          type="button"
          disabled={oauthCfg && !oauthCfg.microsoft}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/65 dark:hover:border-cyan-500/40"
          title={oauthCfg && !oauthCfg.microsoft ? "Configure Microsoft OAuth env on the API first" : undefined}
          onClick={() => void startOutlook()}
        >
          <Mail className="h-8 w-8 shrink-0 text-blue-600" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">Outlook</div>
            <div className="text-xs text-slate-500">Microsoft 365 / Outlook.com — OAuth</div>
          </div>
        </button>
        <Link
          href="/email-marketing/accounts/add/smtp"
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-500/40 dark:border-slate-700 dark:bg-slate-800/65"
        >
          <Mail className="h-8 w-8 shrink-0 text-slate-600" />
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">SMTP / IMAP</div>
            <div className="text-xs text-slate-500">Enter server settings manually (no OAuth env needed)</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
