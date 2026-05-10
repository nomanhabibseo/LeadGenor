import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardPlansModalProvider } from "@/contexts/dashboard-plans-modal-context";
import { sanitizeAppCallbackUrl } from "@/lib/sanitize-app-callback-url";
import { authOptions } from "@/lib/auth-options";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    const h = await headers();
    const raw = h.get("x-lg-callback-url") ?? "/dashboard";
    const safe = sanitizeAppCallbackUrl(raw) ?? "/dashboard";
    redirect(`/login?callbackUrl=${encodeURIComponent(safe)}`);
  }

  return (
    <DashboardPlansModalProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardPlansModalProvider>
  );
}
