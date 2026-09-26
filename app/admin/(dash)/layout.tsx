import "server-only";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminSignedIn } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";

/** Admin data is live; never cache. */
export const dynamic = "force-dynamic";

/**
 * Passcode gate for every admin screen.
 *
 * Without this, the admin pages would be a public window onto every guest's
 * name. The redirect is a usability guard, not the security boundary -- each
 * Server Action re-checks the session too, and the database grants `anon` no
 * write access at all.
 */
export default async function AdminDashLayout({ children }: { children: ReactNode }) {
  if (!(await isAdminSignedIn())) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
