"use client";

import { BrandMark } from "@/components/brand-mark";
import { HeaderAccount } from "@/components/header-account";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  LayoutDashboard,
  List,
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

function NavDropdown({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-100 transition hover:bg-white/10"
      >
        <span className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0 text-cyan-300/90" />
          {title}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-0.5 border-l border-cyan-500/25 py-1 pl-4">{children}</div>
      )}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white",
        active && "bg-white/10 font-medium text-white shadow-sm ring-1 ring-white/10",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
      {label}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [vendorsOpen, setVendorsOpen] = useState(pathname.startsWith("/vendors"));
  const [clientsOpen, setClientsOpen] = useState(pathname.startsWith("/clients"));
  const [ordersOpen, setOrdersOpen] = useState(pathname.startsWith("/orders"));
  const [trashOpen, setTrashOpen] = useState(pathname.startsWith("/trash"));

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-slate-100 dark:bg-brand-gradient">
      <header className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-brand-gradient px-4 pt-3 pb-2.5 shadow-[0_1px_0_rgba(255,255,255,0.06)] dark:border-white/15 dark:shadow-[inset_0_-1px_0_rgba(0,0,0,0.2)] sm:px-5 sm:pt-3.5 sm:pb-3">
        <Link href="/dashboard" className="flex min-w-0 shrink items-center py-0.5">
          <BrandMark
            variant="compact"
            width={240}
            height={48}
            priority
            className="h-10 w-auto max-h-10 max-w-[min(58vw,260px)] sm:h-12 sm:max-h-12 sm:max-w-[280px]"
          />
        </Link>
        <HeaderAccount />
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="relative flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col overflow-hidden border-b border-white/10 bg-brand-gradient md:h-full md:max-h-none md:w-72 md:border-b-0 md:border-r md:border-white/10 dark:border-white/15 dark:shadow-[inset_-1px_0_0_rgba(0,0,0,0.15)]">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-violet-500 to-amber-500 opacity-80 dark:opacity-90"
            aria-hidden
          />
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-3 pb-6 pt-4 md:pb-8">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10",
              pathname === "/dashboard" && "bg-white/10 ring-1 ring-white/15",
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0 text-cyan-300" />
            Dashboard
          </Link>

          <NavDropdown
            title="Vendors"
            icon={Package}
            open={vendorsOpen}
            onToggle={() => setVendorsOpen(!vendorsOpen)}
          >
            <NavLink href="/vendors/new" label="Add New Vendor" icon={Plus} />
            <NavLink href="/vendors" label="Total Vendors" icon={List} />
            <NavLink href="/vendors/deal-done" label="Deal Done Vendors" icon={BadgeCheck} />
            <NavLink href="/vendors/pending" label="Pending Deals" icon={Clock} />
          </NavDropdown>

          <NavDropdown
            title="Clients"
            icon={Users}
            open={clientsOpen}
            onToggle={() => setClientsOpen(!clientsOpen)}
          >
            <NavLink href="/clients/new" label="Add New Client" icon={UserPlus} />
            <NavLink href="/clients" label="Total Clients" icon={Users} />
          </NavDropdown>

          <NavDropdown
            title="Orders"
            icon={ShoppingCart}
            open={ordersOpen}
            onToggle={() => setOrdersOpen(!ordersOpen)}
          >
            <NavLink href="/orders/new" label="Create New Order" icon={PlusCircle} />
            <NavLink href="/orders" label="Total Orders" icon={ShoppingCart} />
            <NavLink href="/orders/completed" label="Completed Orders" icon={CheckCircle2} />
            <NavLink href="/orders/pending" label="Pending Orders" icon={Clock} />
          </NavDropdown>

          <Link
            href="/revenue"
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10",
              pathname.startsWith("/revenue") && "bg-white/10 ring-1 ring-white/15",
            )}
          >
            <Receipt className="h-4 w-4 shrink-0 text-cyan-300" />
            Revenue
          </Link>

          <NavDropdown
            title="Trash"
            icon={Trash2}
            open={trashOpen}
            onToggle={() => setTrashOpen(!trashOpen)}
          >
            <NavLink href="/trash/vendors" label="Vendor Trash" icon={Package} />
            <NavLink href="/trash/clients" label="Client Trash" icon={Users} />
            <NavLink href="/trash/orders" label="Orders Trash" icon={ShoppingCart} />
          </NavDropdown>

          <Link
            href="/settings/trash"
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10",
              pathname === "/settings/trash" && "bg-white/10 ring-1 ring-white/15",
            )}
          >
            <Settings className="h-4 w-4 shrink-0 text-cyan-300" />
            Retention
          </Link>
          </nav>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200/80 dark:bg-brand-gradient">
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-6">
            {pathname !== "/dashboard" && (
              <button
                type="button"
                onClick={() => router.back()}
                className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
