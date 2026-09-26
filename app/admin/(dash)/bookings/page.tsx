import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminShell";
import { BookingConsole } from "@/components/admin/BookingConsole";

export const metadata: Metadata = { title: "การจอง" };
export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  return (
    <div>
      <AdminHeader title="การจอง" subtitle="ค้นหาชื่อ หรือเลือกวันที่เพื่อดูคิว" />
      <BookingConsole />
    </div>
  );
}
