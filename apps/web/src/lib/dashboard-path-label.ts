/** Human-readable path for dashboard chrome (e.g. `email-marketing / campaigns / new`). */
export function dashboardPathLabel(pathname: string | null): string {
  if (!pathname) return "";
  const parts = pathname.replace(/^\//, "").split("/").filter(Boolean);
  return parts.join(" → ");
}
