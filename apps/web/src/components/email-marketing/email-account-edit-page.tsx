"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { PasswordField } from "@/components/password-field";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

const ENC = ["NONE", "SSL", "TLS"] as const;

type Detail = {
  id: string;
  displayName: string;
  fromEmail: string;
  tag: string;
  provider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpEncryption: string;
  hasSmtpPassword?: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapEncryption: string;
  hasImapPassword?: boolean;
  dailyLimit: number;
  delayMinSec: number;
  delayMaxSec: number;
  signature: string;
  bcc: string;
  connectionStatus?: string;
};

export function EmailAccountEditPage({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();

  const [displayName, setDisplayName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [tag, setTag] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpEncryption, setSmtpEncryption] = useState<(typeof ENC)[number]>("TLS");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapEncryption, setImapEncryption] = useState<(typeof ENC)[number]>("TLS");
  const [dailyLimit, setDailyLimit] = useState(10);
  const [delayMode, setDelayMode] = useState<"fixed" | "random">("fixed");
  const [fixedDelaySec, setFixedDelaySec] = useState(60);
  const [randomDelayFromSec, setRandomDelayFromSec] = useState(45);
  const [randomDelayToSec, setRandomDelayToSec] = useState(120);
  const [signature, setSignature] = useState("");
  const [bcc, setBcc] = useState("");

  const { data: acc, isLoading, isError, error } = useQuery({
    queryKey: ["email-account", userKey, accountId],
    queryFn: () => apiFetch<Detail>(`/email-marketing/accounts/${accountId}`, token),
    enabled: status === "authenticated" && !!token && !!userKey,
  });

  useEffect(() => {
    if (!acc) return;
    setDisplayName(acc.displayName);
    setFromEmail(acc.fromEmail);
    setTag(acc.tag);
    setSmtpHost(acc.smtpHost ?? "");
    setSmtpPort(acc.smtpPort ?? 587);
    setSmtpUser(acc.smtpUser ?? "");
    setSmtpPassword("");
    setSmtpEncryption((acc.smtpEncryption as (typeof ENC)[number]) ?? "TLS");
    setImapHost(acc.imapHost ?? "");
    setImapPort(acc.imapPort ?? 993);
    setImapUser(acc.imapUser ?? "");
    setImapPassword("");
    setImapEncryption((acc.imapEncryption as (typeof ENC)[number]) ?? "TLS");
    setDailyLimit(acc.dailyLimit);
    const mn = Number.isFinite(acc.delayMinSec) ? acc.delayMinSec : 0;
    const mx = Number.isFinite(acc.delayMaxSec) ? acc.delayMaxSec : mn;
    if (mn === mx) {
      setDelayMode("fixed");
      setFixedDelaySec(Math.max(0, mn));
    } else {
      setDelayMode("random");
      setRandomDelayFromSec(Math.max(0, Math.min(mn, mx)));
      setRandomDelayToSec(Math.max(0, Math.max(mn, mx)));
    }
    setSignature(acc.signature ?? "");
    setBcc(acc.bcc ?? "");
  }, [acc]);

  const delayMinSec =
    delayMode === "fixed" ? Math.max(0, fixedDelaySec) : Math.max(0, Math.min(randomDelayFromSec, randomDelayToSec));
  const delayMaxSec =
    delayMode === "fixed" ? Math.max(0, fixedDelaySec) : Math.max(0, Math.max(randomDelayFromSec, randomDelayToSec));

  const save = useMutation({
    mutationFn: (smtpLike: boolean) => {
      const body: Record<string, unknown> = {
        displayName: displayName.trim(),
        fromEmail: fromEmail.trim(),
        tag: tag.trim(),
        dailyLimit,
        delayMinSec,
        delayMaxSec,
        signature,
        bcc,
      };
      if (smtpLike) {
        body.smtpHost = smtpHost.trim();
        body.smtpPort = smtpPort;
        body.smtpUser = smtpUser.trim();
        body.smtpEncryption = smtpEncryption;
        if (smtpPassword.trim()) body.smtpPassword = smtpPassword;
        body.imapHost = imapHost.trim() || null;
        body.imapPort = imapPort || null;
        body.imapUser = imapUser.trim() || null;
        body.imapEncryption = imapEncryption;
        if (imapPassword.trim()) body.imapPassword = imapPassword;
      }
      return apiFetch(`/email-marketing/accounts/${accountId}`, token, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["email-accounts", userKey] });
      await qc.invalidateQueries({ queryKey: ["email-account", userKey, accountId] });
      router.push("/email-marketing/accounts");
      router.refresh();
    },
    onError: (e: Error) => void showAlert(e.message),
  });

  const verifySaved = useMutation({
    mutationFn: () =>
      apiFetch(`/email-marketing/accounts/${accountId}/verify`, token, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["email-accounts", userKey] });
      await qc.invalidateQueries({ queryKey: ["email-account", userKey, accountId] });
      void showAlert("Connected — this account verified for sending.");
    },
    onError: (e: Error) => void showAlert(e.message),
  });

  if (status === "loading" || isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 p-8 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (status !== "authenticated" || !token || isError || !acc) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-sm text-red-600">
        {error instanceof Error ? error.message : "Could not load account."}
        <div className="mt-4">
          <Link href="/email-marketing/accounts" className="text-cyan-600 underline">
            Back to accounts
          </Link>
        </div>
      </div>
    );
  }

  const isSmtpLike =
    acc.provider === "SMTP" || acc.provider === "GMAIL_SMTP" || acc.provider === "OTHER";

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit account</h1>
        <Link href="/email-marketing/accounts" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
          Cancel
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
        <p className="text-xs text-slate-500">
          Provider: <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{acc.provider}</span>
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500">From name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">From email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Unique tag</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          </label>
        </div>
      </section>

      {isSmtpLike ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">SMTP</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500">Host</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-500">Port</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Encryption</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                    value={smtpEncryption}
                    onChange={(e) => setSmtpEncryption(e.target.value as (typeof ENC)[number])}
                  >
                    {ENC.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-500">User</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Password (leave blank to keep)</span>
                <PasswordField
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={smtpPassword}
                  onChange={setSmtpPassword}
                  autoComplete="new-password"
                  aria-label="SMTP password"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">IMAP</h2>
            <p className="mt-1 text-xs text-slate-500">Fill all fields to enable inbox sync for this account.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-500">Host</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Port</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={imapPort}
                  onChange={(e) => setImapPort(Number(e.target.value))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">Encryption</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={imapEncryption}
                  onChange={(e) => setImapEncryption(e.target.value as (typeof ENC)[number])}
                >
                  {ENC.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-500">User</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-500">Password (leave blank to keep)</span>
                <PasswordField
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
                  value={imapPassword}
                  onChange={setImapPassword}
                  autoComplete="new-password"
                  aria-label="IMAP password"
                />
              </label>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-cyan-600 px-3 py-2 text-sm text-cyan-800 dark:text-cyan-300"
              disabled={verifySaved.isPending}
              onClick={() => void verifySaved.mutate()}
            >
              {verifySaved.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify saved account (SMTP + IMAP if configured)
            </button>
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          OAuth accounts use provider sign-in. You can update the fields above; to reconnect Gmail or Outlook, use{" "}
          <Link href="/email-marketing/accounts/add" className="font-medium text-cyan-600 underline">
            Add account
          </Link>
          .
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Limits &amp; signature</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500">Daily sending limit</span>
            <div className="mt-1 w-fit">
              <input
                type="number"
                min={1}
                className="w-[4.5rem] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm tabular-nums shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800 dark:focus:border-sky-400"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
              />
            </div>
          </label>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-600">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Delay between emails</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
              Choose one: a fixed pause after each send, or a random pause between a minimum and maximum.
            </p>
            <div className="mt-3 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="delayMode"
                  checked={delayMode === "fixed"}
                  onChange={() => setDelayMode("fixed")}
                />
                Fixed delay between emails (seconds)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="delayMode"
                  checked={delayMode === "random"}
                  onChange={() => setDelayMode("random")}
                />
                Random delay between emails (seconds)
              </label>
            </div>
            {delayMode === "fixed" ? (
              <label className="mt-3 block text-sm">
                <span className="text-slate-500 dark:text-slate-400">Seconds</span>
                <input
                  type="number"
                  min={0}
                  className="app-field-input mt-1 block max-w-[7.5rem] py-1.5 text-sm"
                  value={fixedDelaySec}
                  onChange={(e) => setFixedDelaySec(Number(e.target.value))}
                />
              </label>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Delay min (sec)</span>
                  <input
                    type="number"
                    min={0}
                    className="app-field-input mt-1 block w-[5.5rem] py-1.5 text-sm"
                    value={randomDelayFromSec}
                    onChange={(e) => setRandomDelayFromSec(Number(e.target.value))}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Delay max (sec)</span>
                  <input
                    type="number"
                    min={0}
                    className="app-field-input mt-1 block w-[5.5rem] py-1.5 text-sm"
                    value={randomDelayToSec}
                    onChange={(e) => setRandomDelayToSec(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
          <label className="block text-sm">
            <span className="text-slate-500">Signature</span>
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Bcc (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-save-primary-sm inline-flex items-center gap-2"
          disabled={save.isPending}
          onClick={() => void save.mutate(isSmtpLike)}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
      </div>
    </div>
  );
}
