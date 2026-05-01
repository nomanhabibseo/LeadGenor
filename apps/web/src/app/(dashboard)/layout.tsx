import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardPlansModalProvider } from "@/contexts/dashboard-plans-modal-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardPlansModalProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardPlansModalProvider>
  );
}
