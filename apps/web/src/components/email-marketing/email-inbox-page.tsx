"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

type Msg = {
  id: string;
  snippet: string;
  fromAddr: string;
  subject: string;
  receivedAt: string;
};

export function EmailInboxPage() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const { data: rows = [] } = useQuery({
    queryKey: ["inbox"],
    queryFn: () => apiFetch<Msg[]>("/email-marketing/inbox", token),
    enabled: !!token,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inbox</h1>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600">No messages yet.</p>
        ) : (
          rows.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/65">
              <div className="text-xs text-slate-500">{new Date(m.receivedAt).toLocaleString()}</div>
              <div className="font-medium text-slate-900 dark:text-white">{m.subject || "(no subject)"}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">From {m.fromAddr}</div>
              <p className="mt-2 text-sm">{m.snippet}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
