import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminShell";
import { BookingTimeline } from "@/components/admin/BookingTimeline";
import { getBookingTimeline } from "@/lib/supabase/queries";
import { shopToday } from "@/lib/utils";

export const metadata: Metadata = { title: "คิวประจำวัน" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const today = shopToday();
  const { data, error } = await getBookingTimeline(today);

  return (
    <div>
      <AdminHeader title="คิวประจำวัน" subtitle="ดูช่วงเวลาและสถานะการจองของแต่ละวัน" />
      <BookingTimeline initialDate={today} initialRows={data} initialError={error} />
    </div>
  );
}
