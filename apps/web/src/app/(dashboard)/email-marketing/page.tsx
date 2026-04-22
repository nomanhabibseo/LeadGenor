import Link from "next/link";
import { AtSign, ChevronRight, FolderOpen, List, Megaphone, Inbox } from "lucide-react";

const cards = [
  { href: "/email-marketing/lists", label: "My lists", desc: "Sites, campaigns, auto-update", icon: List },
  { href: "/email-marketing/templates", label: "Templates", desc: "Folders and reusable emails", icon: FolderOpen },
  { href: "/email-marketing/accounts", label: "Email accounts", desc: "SMTP & OAuth senders", icon: AtSign },
  { href: "/email-marketing/campaigns", label: "Campaigns", desc: "Create and track sends", icon: Megaphone },
  { href: "/email-marketing/mailbox", label: "Mailbox", desc: "Inbox, sent, drafts", icon: Inbox },
];

export default function EmailMarketingHubPage() {
  return (
    <div className="em-page mx-auto max-w-4xl space-y-8 px-2 pb-16 sm:px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Email marketing</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage lists, templates, sending accounts, and outreach.</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, label, desc, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="em-card group flex h-full items-center gap-4 transition hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/40"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md dark:bg-indigo-500">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900 dark:text-white">{label}</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
