"use client";

import { BrandMark } from "@/components/brand-mark";
import { HeaderAccount } from "@/components/header-account";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { isTrashModuleEnabled } from "@/lib/trash-toggles";
import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  List,
  Megaphone,
  Package,
  Plus,
  PlusCircle,
  Receipt,
  Settings,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardPathLabel } from "@/lib/dashboard-path-label";

function HeaderEmailMarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition",
          "text-slate-100 hover:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/70",
        )}
      >
        <Megaphone className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        Email marketing
        <ChevronDown className={cn("h-4 w-4 opacity-70 transition", open && "rotate-180")} />
      </button>

      {open ? (
        <>
          <div className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,15rem)] overflow-hidden rounded-2xl border border-slate-800 bg-black p-2 shadow-xl dark:border-slate-700 dark:bg-slate-950">
            <Link
              className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/70 dark:hover:bg-slate-900/60"
              href="/email-marketing/campaigns"
              onClick={() => setOpen(false)}
            >
              Campaigns
            </Link>
            <Link
              className="mt-0.5 block rounded-xl px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/70 dark:hover:bg-slate-900/60"
              href="/email-marketing/campaigns/new"
              onClick={() => setOpen(false)}
            >
              New campaign
            </Link>
            <div className="my-1 border-t border-slate-200/70 dark:border-slate-800" />
            <Link
              className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/70 dark:hover:bg-slate-900/60"
              href="/email-marketing/lists"
              onClick={() => setOpen(false)}
            >
              Lists
            </Link>
            <Link
              className="mt-0.5 block rounded-xl px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/70 dark:hover:bg-slate-900/60"
              href="/email-marketing/templates"
              onClick={() => setOpen(false)}
            >
              Templates
            </Link>
            <Link
              className="mt-0.5 block rounded-xl px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900/70 dark:hover:bg-slate-900/60"
              href="/email-marketing/accounts"
              onClick={() => setOpen(false)}
            >
              Email accounts
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NavDropdown({
  title,
  icon: Icon,
  open,
  onToggle,
  active: parentActive,
  children,
}: {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  /** True when a child route is active (e.g. /vendors/...) */
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
          parentActive
            ? "bg-slate-900/70 text-violet-200 ring-1 ring-violet-500/20 dark:bg-violet-950/55 dark:text-violet-200 dark:ring-violet-800/45"
            : "text-slate-200 hover:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800/85",
        )}
      >
        <span className="flex items-center gap-2.5">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              parentActive
                ? "text-violet-600 dark:text-violet-400"
                : "text-slate-500 dark:text-slate-400",
            )}
          />
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition dark:text-slate-500",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="ml-1 mt-1 space-y-0.5 border-l-2 border-violet-200/60 py-1 pl-3 dark:border-violet-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

function NavLinkSub({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  // Only mark the exact page as active (avoids highlighting "/vendors" while on "/vendors/new").
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 transition hover:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-800/80",
        active && "font-medium text-violet-700 dark:text-violet-300",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
      {label}
    </Link>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800/85",
        active &&
          "bg-slate-950/80 text-violet-200 shadow-sm ring-1 ring-violet-500/20 dark:bg-violet-950/55 dark:text-violet-200 dark:ring-violet-800/45",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-violet-600 dark:text-violet-400" : "text-slate-500 dark:text-slate-400",
        )}
      />
      {label}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const { data: navMe } = useQuery({
    queryKey: ["users", "me", "nav", token],
    queryFn: () => apiFetch<{ trashToggles?: unknown }>("/users/me", token),
    enabled: !!token,
  });
  const toggles = navMe?.trashToggles;
  const [vendorsOpen, setVendorsOpen] = useState(pathname.startsWith("/vendors"));
  const [clientsOpen, setClientsOpen] = useState(pathname.startsWith("/clients"));
  const [ordersOpen, setOrdersOpen] = useState(pathname.startsWith("/orders"));
  const [emailMarketingOpen, setEmailMarketingOpen] = useState(
    pathname.startsWith("/email-marketing"),
  );
  const [trashOpen, setTrashOpen] = useState(
    pathname.startsWith("/trash") || pathname.startsWith("/settings"),
  );

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-black dark:bg-black">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside
          className="relative flex max-h-[44vh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-slate-800 bg-black dark:border-slate-800 dark:bg-slate-950 md:h-full md:max-h-none md:w-[250px] md:border-b-0 md:border-r"
        >
          <div className="border-b border-slate-800 px-4 py-4 dark:border-slate-800 md:border-b-0">
            <Link
              href="/dashboard"
              className="block py-0.5"
            >
              <BrandMark
                variant="sidebar"
                priority
                className="h-10 w-auto max-h-10 max-w-[min(58vw,220px)] sm:h-12 sm:max-h-12"
              />
            </Link>
          </div>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pb-5 pt-2 md:pb-6">
            <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} />
            <NavDropdown
              title="Vendors"
              icon={Package}
              open={vendorsOpen}
              active={pathname.startsWith("/vendors")}
              onToggle={() => setVendorsOpen(!vendorsOpen)}
            >
              <NavLinkSub href="/vendors/new" label="Add new vendor" icon={Plus} />
              <NavLinkSub href="/vendors" label="Total vendors" icon={List} />
              <NavLinkSub href="/vendors/deal-done" label="Deal done vendors" icon={BadgeCheck} />
              <NavLinkSub href="/vendors/pending" label="Pending deals" icon={Clock} />
            </NavDropdown>
            <NavDropdown
              title="Clients"
              icon={Users}
              open={clientsOpen}
              active={pathname.startsWith("/clients")}
              onToggle={() => setClientsOpen(!clientsOpen)}
            >
              <NavLinkSub href="/clients/new" label="Add new client" icon={UserPlus} />
              <NavLinkSub href="/clients" label="Total clients" icon={Users} />
            </NavDropdown>
            <NavDropdown
              title="Orders"
              icon={ShoppingCart}
              open={ordersOpen}
              active={pathname.startsWith("/orders")}
              onToggle={() => setOrdersOpen(!ordersOpen)}
            >
              <NavLinkSub href="/orders/new" label="New order" icon={PlusCircle} />
              <NavLinkSub href="/orders" label="Total orders" icon={ShoppingCart} />
              <NavLinkSub href="/orders/completed" label="Completed orders" icon={CheckCircle2} />
              <NavLinkSub href="/orders/pending" label="Pending orders" icon={Clock} />
            </NavDropdown>
            <NavItem href="/revenue" label="Revenue" icon={Receipt} />

            <NavDropdown
              title="Email marketing"
              icon={Megaphone}
              open={emailMarketingOpen}
              active={pathname.startsWith("/email-marketing") && !pathname.startsWith("/email-marketing/mailbox")}
              onToggle={() => setEmailMarketingOpen(!emailMarketingOpen)}
            >
              <NavLinkSub href="/email-marketing/lists" label="My lists" icon={List} />
              <NavLinkSub href="/email-marketing/templates" label="Templates" icon={FolderOpen} />
              <NavLinkSub href="/email-marketing/accounts" label="Email accounts" icon={AtSign} />
              <NavLinkSub href="/email-marketing/campaigns" label="Campaigns" icon={Megaphone} />
            </NavDropdown>

            <NavItem href="/email-marketing/mailbox" label="Mailbox" icon={Inbox} />
            <NavItem href="/reports" label="Reports" icon={BarChart3} />
            <NavItem href="/settings" label="Settings" icon={Settings} />

            <NavDropdown
              title="Trash"
              icon={Trash2}
              open={trashOpen}
              onToggle={() => setTrashOpen(!trashOpen)}
            >
              {isTrashModuleEnabled(toggles, "vendors") ? (
                <NavLinkSub href="/trash/vendors" label="Vendor trash" icon={Package} />
              ) : null}
              {isTrashModuleEnabled(toggles, "clients") ? (
                <NavLinkSub href="/trash/clients" label="Client trash" icon={Users} />
              ) : null}
              {isTrashModuleEnabled(toggles, "orders") ? (
                <NavLinkSub href="/trash/orders" label="Orders trash" icon={ShoppingCart} />
              ) : null}
              {isTrashModuleEnabled(toggles, "lists") ? (
                <NavLinkSub href="/trash/lists" label="My lists trash" icon={List} />
              ) : null}
              {isTrashModuleEnabled(toggles, "templates") ? (
                <NavLinkSub href="/trash/templates" label="Templates trash" icon={FolderOpen} />
              ) : null}
            </NavDropdown>
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f6fa] dark:bg-slate-950">
          <header className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-black/95 px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/95 sm:px-5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <HeaderEmailMarketingNav />
              <Link
                href="/email-marketing/mailbox"
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition",
                  "text-slate-100 hover:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/70",
                )}
                title="Mailbox"
              >
                <Inbox className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Mailbox
              </Link>
              <Link
                href="/reports"
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition",
                  "text-slate-100 hover:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800/70",
                )}
                title="Reports"
              >
                <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Reports
              </Link>
            </div>
            <div className="flex shrink-0 items-center justify-end">
              <HeaderAccount tone="dark" />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-6">
            {pathname !== "/dashboard" ? (
              <div className="mb-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="mb-3 block text-left text-sm font-medium text-violet-600 transition hover:text-violet-800 hover:underline dark:text-violet-400 dark:hover:text-violet-300"
                >
                  ← Back
                </button>
                <p
                  className="truncate font-mono text-xs leading-tight text-slate-500 dark:text-slate-400"
                  title={dashboardPathLabel(pathname)}
                >
                  {dashboardPathLabel(pathname)}
                </p>
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
