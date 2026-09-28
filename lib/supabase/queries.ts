import { cache } from "react";
import { createAdminClient } from "./admin";
import type {
  Booking,
  BookingStatus,
  BookingWithRefs,
  ISODate,
  TimeSlot,
} from "./types";
import { isActiveBooking } from "./types";
import { formatClockTime } from "@/lib/utils";

/**
 * Admin read layer.
 *
 * Runs on the server with the secret key, behind the passcode gate, so it can
 * see the whole `bookings` table -- including guest names, which the public
 * `anon` role deliberately cannot read.
 *
 * Three rules, all deliberate:
 *
 *  1. No seed fallback. A failed read returns the real Supabase error so the UI
 *     can show it, rather than looking like an empty but healthy shop.
 *  2. Empty is not an error. Zero rows is a legitimate read and renders as an
 *     empty state.
 *  3. Dates live on `time_slots.slot_date`, not on `bookings`, so "today's
 *     bookings" is a join. The join is done in memory because the app's own
 *     tables have no PostgREST-embeddable relationships.
 */

export interface QueryResult<T> {
  data: T;
  ok: boolean;
  /** The real Postgres/PostgREST message, or null when the read succeeded. */
  error: string | null;
}

export const NO_ADMIN_KEY =
  "ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY ฝั่งเซิร์ฟเวอร์ — ระบบจัดการร้านจึงยังใช้ไม่ได้";

function ok<T>(data: T): QueryResult<T> {
  return { data, ok: true, error: null };
}

function fail<T>(context: string, error: unknown, empty: T): QueryResult<T> {
  const message = describe(error);
  console.error(`[supabase] ${context} failed: ${message}`);
  return { data: empty, ok: false, error: message };
}

function describe(error: unknown): string {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    const parts = [e.code, e.message, e.details, e.hint].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return String(error);
}

/* ------------------------------------------------------------------ *
 * time_slots
 * ------------------------------------------------------------------ */

/** Every slot on a date, blocked ones included -- the admin needs to see both. */
export const getSlotsByDate = cache(
  async (date: ISODate): Promise<QueryResult<TimeSlot[]>> => {
    const supabase = createAdminClient();
    if (!supabase) return { data: [], ok: false, error: NO_ADMIN_KEY };

    const { data, error } = await supabase
      .from("time_slots")
      .select("id,slot_date,start_time,end_time,status,created_at")
      .eq("slot_date", date)
      .order("start_time", { ascending: true });

    if (error) return fail("getSlotsByDate", error, []);
    return ok((data ?? []) as TimeSlot[]);
  },
);

/** Distinct dates that have at least one slot, newest first. Drives the picker. */
export const getSlotDates = cache(async (limit = 30): Promise<QueryResult<ISODate[]>> => {
  const supabase = createAdminClient();
  if (!supabase) return { data: [], ok: false, error: NO_ADMIN_KEY };

  const { data, error } = await supabase
    .from("time_slots")
    .select("slot_date")
    .order("slot_date", { ascending: false })
    .limit(limit * 4);

  if (error) return fail("getSlotDates", error, []);

  // `slot_date` is a date column, so PostgREST can return repeats across rows.
  const unique = [...new Set((data ?? []).map((r) => r.slot_date as ISODate))];
  return ok(unique.slice(0, limit));
});

/* ------------------------------------------------------------------ *
 * bookings
 * ------------------------------------------------------------------ */

/**
 * Join a flat booking list to its slots. Bookings carry no date of their own, so
 * both `date` and `time` are derived from the slot.
 */
function attachSlots(
  bookings: Booking[],
  slots: TimeSlot[],
): BookingWithRefs[] {
  const byId = new Map(slots.map((s) => [s.id, s]));

  return bookings.map((booking) => {
    const slot = byId.get(booking.time_slot_id) ?? null;
    return {
      ...booking,
      timeSlot: slot
        ? {
            id: slot.id,
            slot_date: slot.slot_date,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }
        : null,
      date: slot?.slot_date ?? null,
      time: slot ? (formatClockTime(slot.start_time) ?? slot.start_time) : null,
    };
  });
}

/** Loads a date's slots once so several booking filters can share the read. */
async function slotsForDates(dates: ISODate[]): Promise<TimeSlot[]> {
  const supabase = createAdminClient();
  if (!supabase || dates.length === 0) return [];

  const { data } = await supabase
    .from("time_slots")
    .select("id,slot_date,start_time,end_time,status,created_at")
    .in("slot_date", dates);

  return (data ?? []) as TimeSlot[];
}

export interface BookingFilter {
  /** Restrict to a single date. Omit for every booking. */
  date?: ISODate;
  /** Restrict to a date and everything after it. */
  fromDate?: ISODate;
  status?: BookingStatus[];
  /** Case-insensitive match on the guest's typed name. */
  nameQuery?: string;
}

/**
 * Admin booking list.
 *
 * The date lives on the slot, so the read is two steps: find the slot ids for
 * the requested dates, then fetch the bookings that point at them. `in()` is
 * deliberately not given an unbounded list -- an empty id set short-circuits
 * instead of querying with a thousand-element filter.
 */
export const getBookings = cache(
  async (filter: BookingFilter = {}): Promise<QueryResult<BookingWithRefs[]>> => {
    const supabase = createAdminClient();
    if (!supabase) return { data: [], ok: false, error: NO_ADMIN_KEY };

    let slotQuery = supabase
      .from("time_slots")
      .select("id,slot_date,start_time,end_time,status,created_at");

    if (filter.date) {
      slotQuery = slotQuery.eq("slot_date", filter.date);
    } else if (filter.fromDate) {
      slotQuery = slotQuery.gte("slot_date", filter.fromDate);
    }

    const { data: slotRows, error: slotError } = await slotQuery;
    if (slotError) return fail("getBookings(slots)", slotError, []);

    const slots = (slotRows ?? []) as TimeSlot[];

    if (slots.length === 0) {
      return ok([]);
    }

    let bookingQuery = supabase
      .from("bookings")
      .select("id,customer_name,customer_phone,time_slot_id,status,created_at,updated_at")
      .in("time_slot_id", slots.map((s) => s.id));

    if (filter.status && filter.status.length > 0) {
      bookingQuery = bookingQuery.in("status", filter.status);
    }

    const { data: bookingRows, error: bookingError } = await bookingQuery;
    if (bookingError) return fail("getBookings(rows)", bookingError, []);

    let joined = attachSlots((bookingRows ?? []) as Booking[], slots);

    const needle = filter.nameQuery?.trim().toLowerCase();
    if (needle) {
      joined = joined.filter((b) => b.customer_name.toLowerCase().includes(needle));
    }

    joined.sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
    });
    return ok(joined);
  },
);

/** Bookings across every date that has slots -- the dashboard "today + upcoming". */
export async function getAllBookings(): Promise<QueryResult<BookingWithRefs[]>> {
  const supabase = createAdminClient();
  if (!supabase) return { data: [], ok: false, error: NO_ADMIN_KEY };

  const { data: slots, error: slotError } = await supabase
    .from("time_slots")
    .select("id,slot_date,start_time,end_time,status,created_at");

  if (slotError) return fail("getAllBookings(slots)", slotError, []);
  if (!slots || slots.length === 0) return ok([]);

  const { data: bookings, error: bookingError } = await supabase
    .from("bookings")
    .select("id,customer_name,customer_phone,time_slot_id,status,created_at,updated_at")
    .in("time_slot_id", (slots as TimeSlot[]).map((s) => s.id));

  if (bookingError) return fail("getAllBookings(rows)", bookingError, []);

  const joined = attachSlots((bookings ?? []) as Booking[], slots as TimeSlot[]);
  joined.sort((a, b) => {
    const byDate = (a.date ?? "").localeCompare(b.date ?? "");
    if (byDate !== 0) return byDate;
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
  });

  return ok(joined);
}

/**
 * Dashboard counters. Guest count is the number of distinct names, not accounts.
 *
 * `openSlotCount` counts slots a guest could actually book right now, which is
 * the two-part rule: `time_slots.status = 'available'` AND no active booking.
 * Counting only the status would advertise slots that are already taken.
 */
export async function getDashboardStats(date: ISODate) {
  const [{ data: all, error }, slotsResult] = await Promise.all([
    getAllBookings(),
    getSlotsByDate(date),
  ]);

  if (error) return { error, todayCount: 0, pendingCount: 0, guestCount: 0, openSlotCount: 0 };

  const onDate = all.filter((b) => b.date === date);
  // Occupancy is `pending` + `confirmed` only. A completed appointment is done
  // and a cancelled one was abandoned; neither holds the slot.
  const active = onDate.filter((b) => isActiveBooking(b.status));
  const takenSlotIds = new Set(active.map((b) => b.time_slot_id));

  return {
    error: null,
    todayCount: active.length,
    pendingCount: onDate.filter((b) => b.status === "pending").length,
    confirmedCount: onDate.filter((b) => b.status === "confirmed").length,
    completedCount: onDate.filter((b) => b.status === "completed").length,
    guestCount: new Set(all.map((b) => b.customer_name)).size,
    totalSlotCount: slotsResult.data.length,
    openSlotCount: slotsResult.data.filter(
      (s) => s.status === "available" && !takenSlotIds.has(s.id),
    ).length,
    takenSlotCount: slotsResult.data.filter((s) => takenSlotIds.has(s.id)).length,
  };
}

/* ------------------------------------------------------------------ *
 * Slot overview (admin slot manager)
 * ------------------------------------------------------------------ */

export interface SlotOverviewRow {
  slot: TimeSlot;
  /** True while a `pending` or `confirmed` booking holds this slot. */
  isBooked: boolean;
  /** The active booking, so the operator can see whose it is. */
  booking: Pick<Booking, "id" | "customer_name" | "status"> | null;
}

/**
 * A date's slots with their booking state attached.
 *
 * The admin has to tell three things apart that the customer UI collapses into
 * one: `available` (on sale), `blocked` (the owner pulled it), and `booked`
 * (a guest holds it). `booked` is never stored on `time_slots` -- it is derived
 * here from the bookings, so blocking and booking stay independent.
 *
 * Only active bookings are considered. A completed or cancelled booking shows
 * as a free slot, which is the same rule the customer-facing RPC applies.
 */
export const getSlotOverview = cache(
  async (date: ISODate): Promise<QueryResult<SlotOverviewRow[]>> => {
    const supabase = createAdminClient();
    if (!supabase) return { data: [], ok: false, error: NO_ADMIN_KEY };

    const [slotsResult, bookingsResult] = await Promise.all([
      getSlotsByDate(date),
      getBookings({ date }),
    ]);

    if (slotsResult.error) return fail("getSlotOverview(slots)", slotsResult.error, []);
    if (bookingsResult.error) return fail("getSlotOverview(bookings)", bookingsResult.error, []);

    const activeBySlot = new Map<number, Booking>();
    for (const booking of bookingsResult.data) {
      if (!isActiveBooking(booking.status)) continue;
      if (!activeBySlot.has(booking.time_slot_id)) {
        activeBySlot.set(booking.time_slot_id, {
          id: booking.id,
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          time_slot_id: booking.time_slot_id,
          status: booking.status,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        });
      }
    }

    return ok(
      slotsResult.data.map((slot) => {
        const booking = activeBySlot.get(slot.id) ?? null;
        return { slot, isBooked: booking !== null, booking };
      }),
    );
  },
);

export { slotsForDates };
