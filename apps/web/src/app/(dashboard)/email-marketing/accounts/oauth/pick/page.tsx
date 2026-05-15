"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useAppDialog } from "@/contexts/app-dialog-context";
import { apiFetch } from "@/lib/api";
import { sessionQueryUserKey } from "@/lib/session-query-scope";

type PendingRes = {
  provider: string;
  candidates: { email: string; displayName: string }[];
};

function EmailOAuthPickContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingId = searchParams.get("pending");
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const userKey = sessionQueryUserKey(session);
  const qc = useQueryClient();
  const { showAlert } = useAppDialog();
  const [email, setEmail] = useState("");

  const { data, isError, error, isLoading } = useQuery({
    queryKey: ["oauth-pending", userKey, pendingId],
    queryFn: () => apiFetch<PendingRes>(`/email-marketing/oauth/pending/${pendingId}`, token),
    enabled: status === "authenticated" && !!token && !!userKey && !!pendingId,
  });

  useEffect(() => {
    if (data?.candidates?.length && !email) {
      setEmail(data.candidates[0].email);
    }
  }, [data, email]);

  const complete = useMutation({
    mutationFn: () =>
      apiFetch("/email-marketing/oauth/complete", token, {
        method: "POST",
        body: JSON.stringify({ pendingId, email }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["email-accounts", userKey] });
      router.push("/email-marketing/accounts?oauth=done");
    },
    onError: (e: Error) => void showAlert(e.message),
  });

  if (status === "loading" || isLoading) {
    return <div className="mx-auto max-w-lg p-8 text-slate-500">Loading…</div>;
  }

  if (status !== "authenticated" || !token) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-slate-600">Please sign in to continue.</p>
        <Link href="/login" className="mt-2 text-cyan-600 underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (!pendingId) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <p className="text-red-600">Missing pending session. Start again from Add account.</p>
        <Link href="/email-marketing/accounts/add" className="mt-4 inline-block text-cyan-600 underline">
          Add account
        </Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <p className="text-red-600">{(error as Error).message}</p>
        <Link href="/email-marketing/accounts" className="mt-4 inline-block text-cyan-600 underline">
          Back to accounts
        </Link>
      </div>
    );
  }

  const candidates = data?.candidates ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Choose email address</h1>
      </div>
      <div className="space-y-2">
        {candidates.map((c) => (
          <label
            key={c.email}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
              email === c.email ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20" : "border-slate-200 dark:border-slate-700"
            }`}
          >
            <input type="radio" name="pick" checked={email === c.email} onChange={() => setEmail(c.email)} />
            <div>
              <div className="font-medium text-slate-900 dark:text-white">{c.displayName}</div>
              <div className="font-mono text-xs text-slate-500">{c.email}</div>
            </div>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="btn-save-primary inline-flex w-full items-center justify-center gap-2"
        disabled={!email || complete.isPending}
        onClick={() => void complete.mutate()}
      >
        {complete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continue — add account
      </button>
    </div>
  );
}

export default function EmailOAuthPickPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg p-8 text-slate-500">Loading…</div>}>
      <EmailOAuthPickContent />
    </Suspense>
  );
}
