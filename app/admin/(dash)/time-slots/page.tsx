import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminShell";
import { SlotManager } from "@/components/admin/SlotManager";
import { getSlotDates, getSlotOverview } from "@/lib/supabase/queries";
import { shopToday } from "@/lib/utils";

export const metadata: Metadata = { title: "จัดการช่วงเวลา" };
export const dynamic = "force-dynamic";

/**
 * Time-slot management.
 *
 * Slots are created per date (there is no weekly recurrence in the schema), so
 * the date list is whatever dates already have slots, newest first, with today
 * seeded in so the screen is never empty on first open.
 *
 * Each row arrives already joined to its active booking, which is what lets the
 * screen separate available / blocked / booked without a second request.
 */
export default async function AdminTimeSlotsPage() {
  const today = shopToday();
  const datesResult = await getSlotDates();
  const dates = datesResult.data.includes(today)
    ? datesResult.data
    : [today, ...datesResult.data];

  const { data: rows, error } = await getSlotOverview(today);

  return (
    <div>
      <AdminHeader title="จัดการช่วงเวลา" subtitle="เพิ่ม แก้ไข ปิดคิว และลบช่วงเวลาของแต่ละวัน" />

      <SlotManager initialDate={today} dates={dates} initialRows={rows} error={error} />
    </div>
  );
}
