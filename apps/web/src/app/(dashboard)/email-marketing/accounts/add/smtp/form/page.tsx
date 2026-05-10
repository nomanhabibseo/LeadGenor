"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { PasswordField } from "@/components/password-field";
import { apiFetch } from "@/lib/api";
import { getSmtpPreset, type SmtpProviderPreset } from "@/lib/smtp-provider-presets";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

const ENC = ["NONE", "SSL", "TLS"] as const;

function applyPreset(p: SmtpProviderPreset) {
  return {
    smtpHost: p.smtpHost,
    smtpPort: p.smtpPort,
    smtpEncryption: p.smtpEncryption,
    imapHost: p.imapHost ?? "",
    imapPort: p.imapPort ?? 993,
    imapEncryption: p.imapEncryption ?? "TLS",
  };
}

function EmailAccountAddSmtpFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetId = searchParams.get("preset") || "custom";
  const preset = useMemo(() => getSmtpPreset(presetId) ?? getSmtpPreset("custom")!, [presetId]);

  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();

  const [displayName, setDisplayName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [tag, setTag] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapEncryption, setImapEncryption] = useState<(typeof ENC)[number]>("TLS");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpEncryption, setSmtpEncryption] = useState<(typeof ENC)[number]>("TLS");
  const [credUser, setCredUser] = useState("");
  const [credPass, setCredPass] = useState("");
  const [dailyLimit, setDailyLimit] = useState(10);
  const [delayMode, setDelayMode] = useState<"fixed" | "random">("fixed");
  const [fixedDelaySec, setFixedDelaySec] = useState(60);
  const [randomDelayFromSec, setRandomDelayFromSec] = useState(45);
  const [randomDelayToSec, setRandomDelayToSec] = useState(120);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = getSmtpPreset(presetId) ?? getSmtpPreset("custom")!;
    const a = applyPreset(p);
    setSmtpHost(a.smtpHost);
    setSmtpPort(a.smtpPort);
    setSmtpEncryption(a.smtpEncryption);
    setImapHost(a.imapHost);
    setImapPort(a.imapPort);
    setImapEncryption(a.imapEncryption);
  }, [presetId]);

  const hasImap = preset.includeImap && !!(imapHost.trim() && imapPort);

  const delayMinSec = delayMode === "fixed" ? fixedDelaySec : Math.min(randomDelayFromSec, randomDelayToSec);
  const delayMaxSec = delayMode === "fixed" ? fixedDelaySec : Math.max(randomDelayFromSec, randomDelayToSec);

  async function checkAvailabilityAlerts(which: "displayName" | "tag" | "both") {
    if (!token) return;
    try {
      const qs = new URLSearchParams();
      if ((which === "tag" || which === "both") && tag.trim()) {
        qs.set("tag", tag.trim());
      }
      if (![...qs.keys()].length) return;
      const j = await apiFetch<{ displayNameTaken: boolean; tagTaken: boolean }>(
        `/email-marketing/accounts/availability?${qs.toString()}`,
        token,
        { method: "GET" },
      );
      if ((which === "tag" || which === "both") && j.tagTaken) {
        await showAlert("This tag is already used by another account. Please choose a different unique tag.");
      }
    } catch {
      /* ignore availability probe failures on blur */
    }
  }

  async function save() {
    if (!token) return;
    if (!displayName.trim()) {
      await showAlert("Please add a display name (this is how your name appears in the From: line when you send).");
      return;
    }
    if (!tag.trim()) {
      await showAlert(
        "Please add a unique tag for this account (letters, numbers, hyphens — used only inside this app).",
      );
      return;
    }
    if (!fromEmail.trim()) {
      await showAlert("Please enter your email address.");
      return;
    }
    if (!smtpHost.trim() || !credUser.trim() || credPass.length === 0) {
      await showAlert("Please complete SMTP username, password, and host.");
      return;
    }
    if (hasImap && (!imapHost.trim() || !imapPort)) {
      await showAlert("Please complete IMAP host and port, or pick a send-only provider.");
      return;
    }
    const pre = await apiFetch<{ displayNameTaken: boolean; tagTaken: boolean }>(
      `/email-marketing/accounts/availability?${new URLSearchParams({
        tag: tag.trim(),
      }).toString()}`,
      token,
      { method: "GET" },
    );
    if (pre.tagTaken) {
      await showAlert("This tag is already used by another account. Choose a different tag before saving.");
      return;
    }
    setSaving(true);
    try {
      const smtpUser = credUser.trim();
      const smtpPassword = credPass;
      const bodyVerify: Record<string, unknown> = {
        smtpHost: smtpHost.trim(),
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpEncryption,
      };
      if (hasImap) {
        bodyVerify.imapHost = imapHost.trim();
        bodyVerify.imapPort = imapPort;
        bodyVerify.imapUser = smtpUser;
        bodyVerify.imapPassword = smtpPassword;
        bodyVerify.imapEncryption = imapEncryption;
      }

      await apiFetch("/email-marketing/accounts/verify-credentials", token, {
        method: "POST",
        body: JSON.stringify(bodyVerify),
      });

      const createBody: Record<string, unknown> = {
        displayName: displayName.trim(),
        fromEmail: fromEmail.trim(),
        tag: tag.trim(),
        smtpHost: smtpHost.trim(),
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpEncryption,
        dailyLimit,
        delayMinSec,
        delayMaxSec,
      };
      if (hasImap) {
        createBody.imapHost = imapHost.trim();
        createBody.imapPort = imapPort;
        createBody.imapUser = smtpUser;
        createBody.imapPassword = smtpPassword;
        createBody.imapEncryption = imapEncryption;
      }

      await apiFetch("/email-marketing/accounts", token, {
        method: "POST",
        body: JSON.stringify(createBody),
      });

      void qc.invalidateQueries({ queryKey: ["email-accounts", userKey] });
      router.push("/email-marketing/accounts");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let friendly = msg;
      if (msg.includes("SMTP:")) {
        friendly =
          "Your SMTP username or password is incorrect. Please enter the correct username and password and try again.";
      } else if (msg.includes("IMAP:")) {
        friendly =
          "Your IMAP username or password is incorrect. Please enter the correct username and password and try again.";
      }
      await showAlert(friendly);
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <div className="mx-auto max-w-2xl p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Please sign in.</p>
        <Link href="/login" className="mt-2 text-cyan-600 underline dark:text-cyan-400">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-24">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/email-marketing/accounts/add/smtp"
            className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            ← Providers
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">SMTP / IMAP</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {preset.name}
          {preset.hint ? ` — ${preset.hint}` : ""}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Email account information</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Email</span>
            <input
              className="app-field-input"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Display name</span>
            <input
              className="app-field-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => void checkAvailabilityAlerts("displayName")}
              placeholder='e.g. "Acme Sales" or your full name'
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Unique tag (for this app)</span>
            <input
              className="app-field-input font-mono text-xs"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onBlur={() => void checkAvailabilityAlerts("tag")}
              placeholder="e.g. sales-primary (must be unique for your workspace)"
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">SMTP settings</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">SMTP host</span>
            <input
              className="app-field-input"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-500 dark:text-slate-400">SMTP port</span>
              <input
                type="number"
                className="app-field-input"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500 dark:text-slate-400">Encryption</span>
              <select
                className="app-field-select"
                value={smtpEncryption}
                onChange={(e) => setSmtpEncryption(e.target.value as (typeof ENC)[number])}
              >
                {ENC.map((x) => (
                  <option key={x} value={x}>
                    {x} {x === "TLS" ? "(recommended)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {hasImap ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">IMAP settings</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Used for inbox sync. The same username and password apply below.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-500 dark:text-slate-400">IMAP host</span>
              <input
                className="app-field-input"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
                placeholder="imap.example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500 dark:text-slate-400">IMAP port</span>
              <input
                type="number"
                className="app-field-input"
                value={imapPort}
                onChange={(e) => setImapPort(Number(e.target.value))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500 dark:text-slate-400">Encryption</span>
              <select
                className="app-field-select"
                value={imapEncryption}
                onChange={(e) => setImapEncryption(e.target.value as (typeof ENC)[number])}
              >
                {ENC.map((x) => (
                  <option key={x} value={x}>
                    {x} {x === "TLS" ? "(recommended)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/30 dark:text-slate-400">
          This provider is send-only here — IMAP inbox sync is not configured.
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {hasImap ? "Username & password (SMTP + IMAP)" : "Username & password (SMTP)"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Username</span>
            <input
              className="app-field-input"
              value={credUser}
              onChange={(e) => setCredUser(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Password</span>
            <PasswordField
              className="app-field-input"
              value={credPass}
              onChange={setCredPass}
              autoComplete="new-password"
              aria-label="SMTP password"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/65">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sending limits</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-500 dark:text-slate-400">Daily sending limit</span>
            <div className="mt-1 w-fit">
              <input
                type="number"
                min={1}
                className="app-field-input !w-[4.5rem] min-w-0 py-1.5 text-center text-sm tabular-nums"
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
                <input type="radio" name="delayMode" checked={delayMode === "fixed"} onChange={() => setDelayMode("fixed")} />
                Fixed delay between emails (seconds)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="delayMode" checked={delayMode === "random"} onChange={() => setDelayMode("random")} />
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
                  <span className="text-slate-500 dark:text-slate-400">From (sec)</span>
                  <input
                    type="number"
                    min={0}
                    className="app-field-input mt-1 block w-[5.5rem] py-1.5 text-sm"
                    value={randomDelayFromSec}
                    onChange={(e) => setRandomDelayFromSec(Number(e.target.value))}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500 dark:text-slate-400">To (sec)</span>
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
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link href="/email-marketing/accounts/add/smtp" className="rounded-lg px-4 py-2 text-sm">
          Cancel
        </Link>
        <button
          type="button"
          className="btn-save-primary-sm inline-flex items-center gap-2"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save account
        </button>
      </div>
    </div>
  );
}

export default function EmailAccountAddSmtpFormPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl p-8 text-slate-500">Loading…</div>}>
      <EmailAccountAddSmtpFormInner />
    </Suspense>
  );
}
