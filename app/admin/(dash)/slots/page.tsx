import { redirect } from "next/navigation";

/**
 * The slot manager moved to /admin/time-slots. This stays as a redirect so an
 * old bookmark or a revalidated path from an earlier session keeps working
 * instead of 404ing.
 */
export default function LegacyAdminSlotsPage() {
  redirect("/admin/time-slots");
}
