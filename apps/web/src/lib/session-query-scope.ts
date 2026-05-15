import type { Session } from "next-auth";

/** Use in React Query keys so lists are not mixed across accounts after login/logout. */
export function sessionQueryUserKey(session: Session | null): string {
  return session?.user?.id || session?.user?.email || "";
}
