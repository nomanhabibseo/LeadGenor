import { redirect } from "next/navigation";

/** Old “Retention” URL — settings (theme, trash toggles, retention) now live at `/settings`. */
export default function TrashSettingsRedirectPage() {
  redirect("/settings");
}
