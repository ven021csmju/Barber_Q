"use client";

import { getSupabaseClient } from "@/lib/supabase/client";
import type { ISODate, SlotWithAvailability } from "@/lib/supabase/types";
import { removeStartedSlots } from "@/lib/utils";

/**
 * Guest availability for one date.
 *
 * Two reads, because the guest role is deliberately not allowed to read
 * `bookings` (it holds customer names):
 *   1. `time_slots` filtered to the date AND `status = 'available'`
 *   2. `booked_slot_ids(date)`, a SECURITY DEFINER function that returns slot
 *      ids only. Those are subtracted from the first list.
 *
 * Occupancy is never written back onto `time_slots`: a booked slot keeps
 * `status = 'available'` and only stops being offered, so a cancelled booking
 * puts the slot back on sale with no extra write.
 *
 * If either read fails the caller gets the real error instead of an empty list,
 * because an empty list would present every slot as bookable.
 *
 * `bookedIds` is returned alongside the free slots purely so Realtime can be
 * filtered: a `bookings` change event carries no date, only a `time_slot_id`, so
 * "is this change about the day on screen?" is answered by checking that id
 * against the slots we already hold for that day. It is the same RPC result,
 * surfaced -- not a second query, and not a re-implementation of the rule.
 */
export async function fetchAvailability(date: ISODate): Promise<{
  slots: SlotWithAvailability[];
  bookedIds: number[];
  totalAvailable: number;
  error: string | null;
}> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      slots: [],
      bookedIds: [],
      totalAvailable: 0,
      error:
        "ยังไม่ได้ตั้งค่า Supabase — ตรวจสอบ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    };
  }

  // `date` is always a plain "YYYY-MM-DD" string built from the calendar's own
  // year/month/day. It is never produced with `new Date(iso).toISOString()`,
  // which would reinterpret the date in UTC and can shift it by a day.
  console.log("[booking] selectedDate:", date);

  // Two reads in parallel. `time_slots` is filtered to available slots in the
  // query itself; the RPC then removes the ones already booked.
  const [slotsResult, bookedResult] = await Promise.all([
    supabase
      .from("time_slots")
      .select("id, slot_date, start_time, end_time, status")
      .eq("slot_date", date)
      .eq("status", "available")
      .order("start_time", { ascending: true }),
    supabase.rpc("booked_slot_ids", { p_date: date }),
  ]);

  // An error is reported as an error. It is never turned into an empty list,
  // because "the read failed" and "there are no free times" look identical on
  // screen and the guest would be told there is nothing to book.
  if (slotsResult.error) {
    console.error("[booking] time_slots query failed:", slotsResult.error);
    return { slots: [], bookedIds: [], totalAvailable: 0, error: describe(slotsResult.error) };
  }
  if (bookedResult.error) {
    console.error("[booking] booked_slot_ids failed:", bookedResult.error);
    return { slots: [], bookedIds: [], totalAvailable: 0, error: describe(bookedResult.error) };
  }

  const slots = slotsResult.data ?? [];
  const bookedSlots = (bookedResult.data ?? []) as { time_slot_id: number }[];

  // The RPC returns rows of shape { time_slot_id }, not bare ids.
  const bookedIds = new Set(bookedSlots.map((row) => Number(row.time_slot_id)));

  const availableSlots = slots.filter((slot) => !bookedIds.has(Number(slot.id)));
  const bookableSlots = removeStartedSlots(availableSlots, date);

  console.log("[booking] time_slots:", slots);
  console.log("[booking] booked_slot_ids:", bookedSlots);
  console.log("[booking] availableSlots:", bookableSlots);

  return {
    slots: bookableSlots.map((slot) => ({
      ...(slot as unknown as SlotWithAvailability),
      isBooked: false,
    })),
    bookedIds: [...bookedIds],
    // How many slots the shop actually put on sale for this date, before any
    // time-of-day rule is applied. The UI needs this to tell "the shop has no
    // slots on this date" apart from "today's slots have all had their time" --
    // both render as an empty grid. Read from the same rows, not a count query.
    totalAvailable: availableSlots.length,
    error: null,
  };
}

/** Dates that have at least one available slot row in the shop's booking window. */
export async function fetchSlotDates(from: ISODate, to: ISODate): Promise<ISODate[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("time_slots")
    .select("slot_date")
    .eq("status", "available")
    .gte("slot_date", from)
    .lte("slot_date", to);

  if (error) {
    console.error("[booking] slot dates query failed:", error);
    return [];
  }

  return [...new Set((data ?? []).map((row) => row.slot_date as ISODate))];
}

/** Why a booking could not be created, as decided by the database. */
export type BookingFailure =
  | "taken"
  | "blocked"
  | "not_found"
  | "invalid_name"
  | "expired"
  | "config"
  | "error";

/**
 * Create a guest booking -- ONE database call.
 *
 * This is `create_booking(p_customer_name, p_time_slot_id)`, an atomic
 * function, not a select/check/insert sequence. The guest role has no INSERT
 * privilege on `bookings` at all, so this RPC is the only way a booking can
 * exist; the frontend has no way to skip the check even by accident.
 *
 * Concurrency is settled inside the database: the function locks the slot row,
 * re-verifies availability, and the partial unique index rejects a genuine tie.
 * The loser comes back as `{ok:false, reason:'taken'}` -- a controlled result,
 * not an exception. Nothing here decides who wins; React state never does.
 */
export async function createBooking(input: {
  customerName: string;
  timeSlotId: number;
}): Promise<{ ok: true; bookingId: number } | { ok: false; reason: BookingFailure }> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, reason: "config" };
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_customer_name: input.customerName.trim(),
    p_time_slot_id: input.timeSlotId,
  });

  if (error) {
    // The function catches its own unique violation, so an error here means the
    // call itself failed. Logged, not swallowed.
    console.error("[booking] create_booking RPC failed:", error);
    return { ok: false, reason: reasonFromRaisedError(error) };
  }

  // A refusal is raised as an exception, so reaching this point means PostgREST
  // answered 2xx: the function ran to completion and the insert is COMMITTED.
  // Only a payload that explicitly reports failure is treated as a failure.
  //
  // Requiring `ok === true` here is what made the UI announce "booking failed"
  // for rows that were already in the database: any success shape other than
  // the literal `{ ok: true }` envelope -- a bare id, a row, null -- read as
  // failure, and the guest was pushed to book a slot they already held.
  if (isExplicitFailure(data)) {
    console.warn("[booking] create_booking returned a failure payload:", data);
    return { ok: false, reason: reasonFromFailureText(payloadField(data, "reason")) };
  }

  return { ok: true, bookingId: extractBookingId(data) };
}

/**
 * The deployed `create_booking()` refuses a booking by RAISE EXCEPTION with a
 * sentinel message (Postgres code `P0001`), not by returning the
 * `{ ok: false, reason }` envelope. Both shapes are handled: the envelope below,
 * and these sentinels here.
 *
 * Mapping them matters for more than wording. `taken` is what makes the UI show
 * "that time was just taken" AND re-read the grid, so the slot the guest just
 * lost disappears from the screen. Left as a generic error, the stale slot would
 * stay on offer and every retry would fail the same way.
 *
 * `TIME_SLOT_ALREADY_BOOKED` is the sentinel observed in production. The other
 * two are defensive: if the function refuses a blocked or removed slot the same
 * way, the guest gets the accurate message without another code change. An
 * unrecognised error still falls through to "error" -- never silently accepted.
 */
const RAISED_REASONS: Record<string, BookingFailure> = {
  TIME_SLOT_ALREADY_BOOKED: "taken",
  TIME_SLOT_BLOCKED: "blocked",
  TIME_SLOT_NOT_AVAILABLE: "blocked",
  TIME_SLOT_NOT_FOUND: "not_found",
  CUSTOMER_NAME_REQUIRED: "invalid_name",
  // The slot's start time passed in shop time while the guest was deciding, or
  // the date is already behind us. A distinct reason from `taken` so the guest
  // is told to pick another time instead of being told the slot was taken.
  TIME_SLOT_EXPIRED: "expired",
};

/** Normalises both contracts: a raised sentinel, or an `{ok:false, reason}` field. */
function reasonFromFailureText(raw: unknown): BookingFailure {
  const text = String(raw ?? "").trim();

  const bySentinel = RAISED_REASONS[text.toUpperCase()];
  if (bySentinel) return bySentinel;

  const lower = text.toLowerCase();
  if (
    lower === "taken" ||
    lower === "blocked" ||
    lower === "not_found" ||
    lower === "invalid_name" ||
    lower === "expired"
  ) {
    return lower;
  }
  return "error";
}

function reasonFromRaisedError(error: unknown): BookingFailure {
  const raw =
    typeof error === "object" && error !== null
      ? (error as { message?: unknown }).message
      : error;
  return reasonFromFailureText(raw);
}

function payloadField(data: unknown, field: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[field];
}

/**
 * Only a payload that positively reports failure counts as one. A missing
 * `ok` field is NOT a failure -- on a 2xx the row is already written, and
 * claiming otherwise would tell the guest their confirmed booking vanished.
 */
function isExplicitFailure(data: unknown): boolean {
  const ok = payloadField(data, "ok");

  if (ok === false) return true;
  if (ok === true) return false;

  const reason = payloadField(data, "reason");
  return typeof reason === "string" && reason.trim().length > 0;
}

/** Best effort. The booking id is not used by the guest UI, only the outcome. */
function extractBookingId(data: unknown): number {
  if (typeof data === "number" && Number.isFinite(data)) return data;

  if (typeof data === "string" && /^\d+$/.test(data.trim())) return Number(data.trim());

  for (const candidate of [payloadField(data, "bookingId"), payloadField(data, "id")]) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function describe(error: unknown): string {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    return [e.code, e.message, e.details, e.hint].filter(Boolean).join(" | ");
  }
  return String(error);
}
