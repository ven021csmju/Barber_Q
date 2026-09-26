"use client";

import { useRef, useState } from "react";
import { BookingList } from "@/components/admin/BookingList";
import { EmptyState, ReadError } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { useBookingSignal } from "@/lib/supabase/realtime";
import type { BookingStatus, BookingWithRefs, ISODate } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Booking browser: filter by date, search a guest name, filter by status.
 *
 * The list is fetched through a Server Action rather than from the browser,
 * because `bookings` is not readable by the `anon` role -- guest names must not
 * be shipped to an unauthenticated client.
 */
export function BookingConsole() {
  const [bookings, setBookings] = useState<BookingWithRefs[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<ISODate | "">("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Guards against a burst of changes stacking up searches.
   *
   * A single guest action can commit more than one row change, and each one
   * would otherwise start its own request. Overlapping requests also race: the
   * slower one wins and repaints the list with rows that no longer match the
   * filters. So a change arriving mid-search sets a single dirty flag instead, and
   * one more search runs when the current one finishes -- for the same filters,
   * which are the ones on screen.
   */
  const inFlight = useRef(false);
  const dirty = useRef(false);

  /** Set once the owner has actually searched; the empty state is a choice, not stale data. */
  const hasSearched = useRef(false);

  async function runSearch(nextDate: ISODate | "", nextQuery: string, nextStatus: BookingStatus | "") {
    if (inFlight.current) {
      dirty.current = true;
      return;
    }
    inFlight.current = true;
    hasSearched.current = true;

    setLoading(true);
    setError(null);

    const { searchBookings } = await import("@/app/admin/(dash)/actions");
    const result = await searchBookings({
      date: nextDate || undefined,
      nameQuery: nextQuery || undefined,
      status: nextStatus || undefined,
    });

    setLoading(false);
    inFlight.current = false;
    if (!result.ok) {
      setError(result.error ?? "โหลดข้อมูลไม่สำเร็จ");
      setBookings([]);
    } else {
      setBookings(result.data);
      // Re-render BookingList with fresh rows.
      setReloadKey((k) => k + 1);
    }

    if (dirty.current) {
      dirty.current = false;
      void runSearch(nextDate, nextQuery, nextStatus);
    }
  }

  /**
   * Someone booked, cancelled, or confirmed something -- re-run the search that is
   * already on screen.
   *
   * This arrives as a broadcast signal rather than a `bookings` table change,
   * because this component holds only the publishable key and therefore runs as
   * `anon`, which is refused every row of `bookings` -- by design, since those
   * rows carry guest names. A published table would not help; RLS is what decides
   * whether the change is delivered. See `BOOKING_SIGNAL_TOPIC`.
   *
   * The signal is only ever a knock on the door: it says which slot moved, nothing
   * about who booked it. Which rows may be shown, and whether this session may see
   * them at all, is decided by `searchBookings`, which re-checks the admin session
   * on every call. No guest name, note, or status is read from a payload here.
   */
  useBookingSignal(() => {
    if (!hasSearched.current) return; // nothing on screen yet; don't search uninvited
    void runSearch(date, query, status);
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch(date, query, status);
            }}
            placeholder="ค้นหาชื่อลูกค้า"
            aria-label="ค้นหาชื่อลูกค้า"
            className="min-h-11 w-full rounded-2xl bg-ink-800 px-3.5 text-sm text-white ring-1 ring-white/10 placeholder:text-white/30 focus:ring-2 focus:ring-gold-500 focus:outline-none"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="กรองตามวันที่"
            className="min-h-11 w-full rounded-2xl bg-ink-800 px-3.5 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none sm:w-44"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["", "pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => {
                setStatus(s);
                void runSearch(date, query, s);
              }}
              className={cn(
                "min-h-9 rounded-xl px-3 text-xs font-bold transition-colors",
                status === s
                  ? "bg-gold-500 text-ink-950"
                  : "bg-ink-800 text-white/55 hover:bg-green-800 hover:text-white",
              )}
            >
              {s === ""
                ? "ทั้งหมด"
                : s === "pending"
                  ? "รอยืนยัน"
                  : s === "confirmed"
                    ? "ยืนยันแล้ว"
                    : s === "completed"
                      ? "เสร็จสิ้น"
                      : "ยกเลิก"}
            </button>
          ))}

          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => void runSearch(date, query, status)}
            loading={loading}
          >
            ค้นหา
          </Button>
        </div>
      </div>

      {error ? <ReadError error={error} /> : null}

      {bookings === null ? (
        <EmptyState title="เลือกเงื่อนไขเพื่อค้นหา" description="ค้นหาด้วยชื่อ หรือเลือกวันที่" compact />
      ) : bookings.length === 0 ? (
        <EmptyState title="ไม่พบการจอง" description="ลองเปลี่ยนวันที่ ชื่อ หรือสถานะ" compact />
      ) : (
        <BookingList key={reloadKey} bookings={bookings} />
      )}
    </div>
  );
}
