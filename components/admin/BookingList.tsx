"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatThaiDate } from "@/lib/utils";
import {
  BOOKING_TRANSITIONS,
  type BookingStatus,
  type BookingWithRefs,
} from "@/lib/supabase/types";

/**
 * Action labels for each legal move.
 *
 * The moves themselves come from `BOOKING_TRANSITIONS`, the same table the
 * server action validates against. Deriving the buttons from it means the owner
 * is never offered a change that would be refused -- and if the flow is edited
 * in one place, both sides follow.
 */
const ACTION_LABEL: Partial<Record<BookingStatus, string>> = {
  confirmed: "ยืนยัน",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

const TONE: Record<BookingStatus, "warning" | "success" | "neutral" | "danger"> = {
  pending: "warning",
  confirmed: "success",
  completed: "neutral",
  cancelled: "danger",
};

const LABEL: Record<BookingStatus, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
};

/** `2026-09-26T17:56:27.525345+00:00` -> `17:56` in the shop's own clock. */
function createdClock(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

/**
 * Admin booking list.
 *
 * Guest names are shown here and only here: the public `anon` role has no read
 * access to `bookings`, so this data is reachable exclusively from server code
 * behind the passcode.
 */
export function BookingList({ bookings }: { bookings: BookingWithRefs[] }) {
  const [items, setItems] = useState(bookings);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(bookingId: number, status: BookingStatus) {
    const previous = items;
    setError(null);
    setBusyId(bookingId);
    // Optimistic: reflect the change immediately, revert if the write fails.
    setItems((list) => list.map((b) => (b.id === bookingId ? { ...b, status } : b)));

    const { changeBookingStatus } = await import("@/app/admin/(dash)/actions");
    const result = await changeBookingStatus(bookingId, status);
    setBusyId(null);
    if (!result.ok) {
      setItems(previous);
      setError(result.error ?? "อัปเดตสถานะไม่สำเร็จ");
    }
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-white/45">ไม่มีการจอง</p>;
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="m-4 rounded-2xl bg-danger/15 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-white/8">
        {items.map((booking) => {
          const moves = BOOKING_TRANSITIONS[booking.status];
          const busy = busyId === booking.id;

          return (
            <li key={booking.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <div className="w-20 shrink-0 text-center">
                <p className="font-display text-base font-bold text-gold-500 tabular-nums">
                  {booking.time ?? "--:--"}
                </p>
                {booking.date ? (
                  <p className="text-[0.65rem] text-white/40">{formatThaiDate(booking.date)}</p>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-sm font-bold text-white">
                  {booking.customer_name}
                </p>
                {booking.customer_phone ? (
                  <a
                    href={`tel:${booking.customer_phone}`}
                    className="block truncate text-xs font-bold text-gold-500 hover:text-gold-400"
                  >
                    โทร {booking.customer_phone}
                  </a>
                ) : (
                  <p className="text-xs text-white/35">ไม่ระบุเบอร์โทร</p>
                )}
                <p className="truncate text-xs text-white/40">
                  #{booking.id}
                  {booking.slotStart && booking.slotEnd
                    ? ` · ${booking.slotStart.slice(0, 5)}–${booking.slotEnd.slice(0, 5)}`
                    : booking.timeSlot
                      ? ` · ${booking.timeSlot.start_time.slice(0, 5)}–${booking.timeSlot.end_time.slice(0, 5)}`
                      : " · ไม่พบช่วงเวลา"}
                  {booking.serviceName ? ` · ${booking.serviceName}` : " · ไม่ระบุ"}
                </p>
                <p className="truncate text-[0.65rem] text-white/30">
                  สร้างเมื่อ {createdClock(booking.created_at)}
                </p>
              </div>

              <Badge tone={TONE[booking.status]}>{LABEL[booking.status]}</Badge>

              <div className="flex shrink-0 gap-2">
                {moves.map((next) => {
                  const isCancel = next === "cancelled";
                  return (
                    <button
                      key={next}
                      type="button"
                      disabled={busy}
                      onClick={() => apply(booking.id, next)}
                      className={
                        isCancel
                          ? "min-h-9 rounded-full bg-ink-800 px-2.5 text-xs font-bold text-white/55 transition-colors hover:bg-danger/20 hover:text-danger disabled:opacity-50"
                          : "min-h-9 rounded-full bg-gold-500 px-2.5 text-xs font-bold text-ink-950 transition-colors hover:bg-gold-400 disabled:opacity-50"
                      }
                    >
                      {ACTION_LABEL[next] ?? next}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
