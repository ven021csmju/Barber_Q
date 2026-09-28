"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ReadError } from "@/components/ui/Feedback";
import { useBookingSignal } from "@/lib/supabase/realtime";
import type { BookingStatus, ISODate } from "@/lib/supabase/types";
import type { BookingTimelineRow } from "@/lib/supabase/queries";
import { formatThaiDate, toISODate, toLocalDate } from "@/lib/utils";

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const STATUS_TONE: Record<BookingStatus, "warning" | "success" | "neutral" | "danger"> = {
  pending: "warning",
  confirmed: "success",
  completed: "neutral",
  cancelled: "danger",
};

function addDays(date: ISODate, amount: number): ISODate {
  const next = toLocalDate(date);
  next.setDate(next.getDate() + amount);
  return toISODate(next);
}

export function BookingTimeline({
  initialDate,
  initialRows,
  initialError,
}: {
  initialDate: ISODate;
  initialRows: BookingTimelineRow[];
  initialError: string | null;
}) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async (nextDate: ISODate) => {
    setDate(nextDate);
    setLoading(true);
    setError(null);

    const { loadBookingTimelineForDate } = await import("@/app/admin/(dash)/actions");
    const result = await loadBookingTimelineForDate(nextDate);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "โหลดไทม์ไลน์ไม่สำเร็จ");
      return;
    }
    setRows(result.data);
    setExpanded(new Set());
  }, []);

  useBookingSignal(() => {
    void load(date);
  });

  function toggle(slotId: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  async function confirmBooking(bookingId: number) {
    setBusyId(bookingId);
    setError(null);
    const { changeBookingStatus } = await import("@/app/admin/(dash)/actions");
    const result = await changeBookingStatus(bookingId, "confirmed");
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? "ยืนยันคิวไม่สำเร็จ");
      return;
    }
    await load(date);
  }

  async function cancelBooking(bookingId: number) {
    setBusyId(bookingId);
    setError(null);
    const { changeBookingStatus } = await import("@/app/admin/(dash)/actions");
    const result = await changeBookingStatus(bookingId, "cancelled");
    setBusyId(null);

    if (!result.ok) {
      setError(result.error ?? "ยกเลิกคิวไม่สำเร็จ");
      return;
    }
    await load(date);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-ink-900 p-4">
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.24em] text-white/35 uppercase">Daily queue</p>
          <p className="mt-1 font-serif text-2xl text-white">{formatThaiDate(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load(addDays(date, -1))} aria-label="วันก่อนหน้า" className="grid size-10 place-items-center rounded-full border border-white/15 text-lg text-white hover:bg-white hover:text-ink-950">←</button>
          <input type="date" value={date} onChange={(event) => event.target.value && void load(event.target.value)} aria-label="เลือกวันที่" className="min-h-10 rounded-xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none" />
          <button type="button" onClick={() => void load(addDays(date, 1))} aria-label="วันถัดไป" className="grid size-10 place-items-center rounded-full border border-white/15 text-lg text-white hover:bg-white hover:text-ink-950">→</button>
        </div>
      </div>

      {error ? <ReadError error={error} /> : null}

      <div className="relative pl-8 sm:pl-12" aria-busy={loading}>
        <div aria-hidden className="absolute top-3 bottom-3 left-[0.7rem] w-px bg-white/15 sm:left-[1.2rem]" />
        {rows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-ink-900 px-4 py-10 text-center text-sm text-white/45">วันนี้ยังไม่มีช่วงเวลา</div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const activeBookings = row.bookings.filter((booking) => booking.status === "pending" || booking.status === "confirmed");
              const history = row.bookings.filter((booking) => booking.status !== "pending" && booking.status !== "confirmed");
              const open = expanded.has(row.slot.id);
              const blocked = row.slot.status === "blocked";

              return (
                <div key={row.slot.id} className="relative">
                  <span aria-hidden className={[
                    "absolute -left-[2rem] top-5 grid size-6 place-items-center rounded-full border text-xs sm:-left-[2.75rem]",
                    row.isBooked ? "border-white bg-white text-ink-950" : blocked ? "border-white/20 bg-ink-950 text-white/30" : "border-white/30 bg-ink-950 text-white/60",
                  ].join(" ")}>{row.isBooked ? "●" : blocked ? "—" : "○"}</span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggle(row.slot.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggle(row.slot.id);
                      }
                    }}
                    aria-expanded={open}
                    className="w-full rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-left transition-colors hover:border-white/25"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-bold text-white tabular-nums">{row.slot.start_time.slice(0, 5)} <span className="text-sm text-white/35">– {row.slot.end_time.slice(0, 5)}</span></p>
                        <p className="mt-1 text-xs text-white/40">{blocked ? "ปิดคิว" : row.isBooked ? `${activeBookings.length} การจองที่กำลังดำเนินการ` : "ว่าง"}</p>
                      </div>
                      <span className="text-lg text-white/50">{open ? "−" : "+"}</span>
                    </div>
                    {activeBookings.length > 0 ? <div className="mt-3 space-y-1 border-t border-white/10 pt-3">{activeBookings.map((booking) => <p key={booking.id} className="text-sm font-bold text-white">{booking.customer_name}</p>)}</div> : null}
                  </div>

                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                        <div className="space-y-3 px-2 pb-2 pt-2">
                          {[...activeBookings, ...history].map((booking) => (
                            <div key={booking.id} className="rounded-2xl border border-white/10 bg-ink-800 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div><p className="font-bold text-white">{booking.customer_name}</p><p className="mt-1 text-xs text-white/45">{booking.customer_phone ?? "ไม่ระบุเบอร์โทร"}</p></div>
                                <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/55">
                                <div><dt className="text-white/30">บริการ</dt><dd>ไม่ระบุ</dd></div>
                                <div><dt className="text-white/30">เวลา</dt><dd>{row.slot.start_time.slice(0, 5)} – {row.slot.end_time.slice(0, 5)}</dd></div>
                              </dl>
                              {booking.status === "pending" ? (
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                  <Button
                                    size="sm"
                                    loading={busyId === booking.id}
                                    disabled={busyId !== null}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void confirmBooking(booking.id);
                                    }}
                                  >
                                    ยืนยันคิว
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    className="bg-red-700 hover:bg-red-600"
                                    disabled={busyId !== null}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void cancelBooking(booking.id);
                                    }}
                                  >
                                    ยกเลิกคิว
                                  </Button>
                                </div>
                              ) : booking.status === "confirmed" ? (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="mt-4 w-full bg-red-700 hover:bg-red-600"
                                  loading={busyId === booking.id}
                                  disabled={busyId !== null}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void cancelBooking(booking.id);
                                  }}
                                >
                                  ยกเลิกคิว
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
