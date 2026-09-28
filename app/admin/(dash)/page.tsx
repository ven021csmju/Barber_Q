import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Panel, StatCard } from "@/components/admin/StatCard";
import { DashboardLiveRefresh } from "@/components/admin/DashboardLiveRefresh";
import { EmptyState, ReadError } from "@/components/ui/Feedback";
import { ButtonLink } from "@/components/ui/Button";
import { BookingList } from "@/components/admin/BookingList";
import { getAllBookings, getDashboardStats } from "@/lib/supabase/queries";
import { shopToday } from "@/lib/utils";

export const metadata: Metadata = { title: "ภาพรวม" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const today = shopToday();

  const [stats, { data: all, error }] = await Promise.all([
    getDashboardStats(today),
    getAllBookings(),
  ]);

  const todayQueue = all.filter(
    (b) => b.date === today && (b.status === "pending" || b.status === "confirmed"),
  );
  todayQueue.sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
  });

  return (
    <div>
      <DashboardLiveRefresh />

      <AdminHeader
        title="ภาพรวมร้าน"
        subtitle="คิววันนี้"
        action={
          <ButtonLink href="/admin/bookings" size="sm">
            จัดการคิว
          </ButtonLink>
        }
      />

      {stats.error ? <ReadError error={stats.error} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ทั้งหมด" value={String(stats.totalSlotCount)} tone="gold" />
        <StatCard label="ว่าง" value={String(stats.openSlotCount)} />
        <StatCard label="จองแล้ว" value={String(stats.takenSlotCount)} />
        <StatCard label="รอยืนยัน" value={String(stats.pendingCount)} />
        <StatCard label="ยืนยันแล้ว" value={String(stats.confirmedCount)} />
        <StatCard label="เสร็จสิ้น" value={String(stats.completedCount)} />
        <StatCard label="คิวที่ต้องดำเนินการ" value={String(stats.todayCount)} />
        <StatCard label="ลูกค้าที่เคยจอง" value={String(stats.guestCount)} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel
          title="คิววันนี้"
          description={`${todayQueue.length} คิวที่ต้องดำเนินการ`}
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          {error ? (
            <div className="p-4">
              <ReadError error={error} />
            </div>
          ) : todayQueue.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="ไม่มีคิววันนี้"
                description="ยังไม่มีการจองสำหรับวันนี้"
                compact
              />
            </div>
          ) : (
            <BookingList bookings={todayQueue} />
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="ทางลัด">
            <div className="grid grid-cols-2 gap-2.5 p-4">
              <ButtonLink href="/admin/bookings" variant="ghost" size="sm">
                ดูคิวทั้งหมด
              </ButtonLink>
              <ButtonLink href="/admin/time-slots" variant="ghost" size="sm">
                จัดการเวลา
              </ButtonLink>
            </div>
          </Panel>

          <Panel title="หมายเหตุ">
            <p className="p-4 text-sm leading-relaxed text-white/55">
              ระบบนี้เป็นการจองแบบไม่ต้องสมัครสมาชิก ลูกค้าเลือกวัน เวลา
              และกรอกชื่อเท่านั้น การเปลี่ยนสถานะคิวทำได้ที่เมนู
              การจอง
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
