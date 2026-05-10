import { Loader2 } from "lucide-react";

/** Light shell so nav stays primary; full-viewport spinners feel slow on every in-app nav. */
export default function DashboardRouteLoading() {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 py-12 text-slate-500 dark:text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin text-violet-500 dark:text-violet-400" aria-hidden />
      <p className="text-sm">Loading page…</p>
    </div>
  );
}
