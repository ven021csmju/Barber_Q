import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };
export const dynamic = "force-dynamic";

/**
 * The one public admin route. If a session cookie is already valid it skips the
 * form, so a bookmarked `/admin` lands on the dashboard after one sign-in.
 */
export default async function AdminLoginPage() {
  return <AdminLoginForm />;
}
