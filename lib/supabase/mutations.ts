import { createAdminClient, ADMIN_KEY_MISSING } from "./admin";
import {
  ACTIVE_BOOKING_STATUSES,
  canTransitionBooking,
  isActiveBooking,
  type Booking,
  type BookingStatus,
  type ClockTime,
  type ISODate,
  type TimeSlot,
} from "./types";

/**
 * Admin writes.
 *
 * These run server-side with the secret key, so they bypass RLS by design. That
 * is safe only because every caller sits behind the passcode session in
 * `lib/admin-auth.ts`; there is deliberately no anon write policy in the
 * database, so a browser cannot reach any of this.
 *
 * Every guard here is duplicated in the UI so the operator is not offered an
 * action that will be refused, but the check that matters is this one: the
 * browser can be bypassed, the server cannot. A rule enforced only in React is
 * a suggestion.
 */

export interface WriteResult {
  ok: boolean;
  error: string | null;
}

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** §5/§7 wording. Shown whenever an active booking stands in the way. */
const BOOKED_BLOCKS_EDIT = "คิวนี้มีการจองอยู่ ไม่สามารถแก้ไขหรือลบได้";
const BOOKED_BLOCKS_CLOSE = "คิวนี้มีการจองอยู่ ไม่สามารถปิดคิวได้";
const BOOKED_BLOCKS_DELETE = "ไม่สามารถลบคิวที่มีการจองได้";

const SLOT_COLUMNS = "id,slot_date,start_time,end_time,status,created_at";

/**
 * The active booking on a slot, or null.
 *
 * `pending` and `confirmed` only: a completed or cancelled booking leaves the
 * slot free, so it must not block the owner from managing that timeslot.
 */
async function findActiveBooking(slotId: number): Promise<Booking | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("bookings")
    .select("id,customer_name,time_slot_id,status,created_at,updated_at")
    .eq("time_slot_id", slotId)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .limit(1);

  if (error) {
    console.error("[admin] findActiveBooking failed:", error.message);
    return null;
  }
  return ((data ?? []) as Booking[])[0] ?? null;
}

async function getSlot(slotId: number): Promise<TimeSlot | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("time_slots")
    .select(SLOT_COLUMNS)
    .eq("id", slotId)
    .maybeSingle();

  if (error) {
    console.error("[admin] getSlot failed:", error.message);
    return null;
  }
  return (data as TimeSlot | null) ?? null;
}

/* ------------------------------------------------------------------ *
 * Bookings
 * ------------------------------------------------------------------ */

/**
 * Moves a booking between states.
 *
 * The transition is validated against `BOOKING_TRANSITIONS` here rather than
 * only in the UI: `completed` and `cancelled` are terminal, so a stale tab or a
 * crafted request cannot reopen a finished appointment and hand a slot back to
 * a guest who already had it.
 */
export async function setBookingStatus(
  bookingId: number,
  status: BookingStatus,
): Promise<WriteResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: ADMIN_KEY_MISSING };

  const { data: current, error: readError } = await supabase
    .from("bookings")
    .select("id,status")
    .eq("id", bookingId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!current) return { ok: false, error: "ไม่พบการจองนี้" };

  const from = current.status as BookingStatus;

  if (from === status) return { ok: true, error: null };

  if (!canTransitionBooking(from, status)) {
    return {
      ok: false,
      error: `ไม่สามารถเปลี่ยนสถานะการจองได้ (${from} → ${status})`,
    };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/* ------------------------------------------------------------------ *
 * Time slots
 * ------------------------------------------------------------------ */

/**
 * Opens or closes a slot.
 *
 * Blocking pulls a slot from sale without deleting it, so its history survives.
 * A slot a guest is holding cannot be closed out from under them (§7).
 */
export async function setSlotBlocked(
  slotId: number,
  blocked: boolean,
): Promise<WriteResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: ADMIN_KEY_MISSING };

  if (blocked) {
    const active = await findActiveBooking(slotId);
    if (active) return { ok: false, error: BOOKED_BLOCKS_CLOSE };
  }

  const { error } = await supabase
    .from("time_slots")
    .update({ status: blocked ? "blocked" : "available" })
    .eq("id", slotId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/**
 * Creates one or more slots on a date.
 *
 * Times arrive as "HH:MM" and are widened to Postgres `time` ("HH:MM:SS").
 * Input is rejected here rather than sent on to fail as a 400, and the date is
 * checked for overlaps against what already exists.
 *
 * §4: duplicates must not be created silently. The overlap test is done in the
 * server action, which is authoritative, but it is still a read-then-write and
 * two owners saving at once could race. Only a unique/exclusion constraint in
 * the database closes that window for good -- see the migration note in the
 * hand-off.
 */
export async function createSlots(input: {
  slotDate: ISODate;
  times: { startTime: string; endTime: string }[];
}): Promise<WriteResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: ADMIN_KEY_MISSING };

  if (input.times.length === 0) {
    return { ok: false, error: "กรุณาเพิ่มเวลาอย่างน้อยหนึ่งช่วง" };
  }

  const rows: { slot_date: ISODate; start_time: ClockTime; end_time: ClockTime }[] = [];

  for (const t of input.times) {
    const start = toTime(t.startTime);
    const end = toTime(t.endTime);

    if (!start || !end) {
      return { ok: false, error: "รูปแบบเวลาไม่ถูกต้อง ต้องเป็น HH:MM" };
    }
    if (end <= start) {
      return { ok: false, error: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม" };
    }

    rows.push({ slot_date: input.slotDate, start_time: start, end_time: end });
  }

  // Overlap inside the submitted batch, before the database is touched.
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (overlaps(rows[i], rows[j])) {
        return {
          ok: false,
          error: `ช่วงเวลาซ้ำกัน: ${hhmm(rows[i].start_time)} ทับ ${hhmm(rows[j].start_time)}`,
        };
      }
    }
  }

  // Overlap against slots already on that date.
  const { data: existing, error: readError } = await supabase
    .from("time_slots")
    .select(SLOT_COLUMNS)
    .eq("slot_date", input.slotDate);

  if (readError) return { ok: false, error: readError.message };

  for (const row of rows) {
    for (const slot of (existing ?? []) as TimeSlot[]) {
      if (overlaps(row, slot)) {
        return {
          ok: false,
          error: `ช่วงเวลานี้มีอยู่แล้ว (${hhmm(slot.start_time)} – ${hhmm(slot.end_time)})`,
        };
      }
    }
  }

  const { error } = await supabase
    .from("time_slots")
    .insert(rows.map((r) => ({ ...r, status: "available" as const })));

  if (error) return { ok: false, error: friendlyInsertError(error) };
  return { ok: true, error: null };
}

/**
 * Edits a slot's date, times or status.
 *
 * A slot with an active booking is frozen (§5): moving it would invalidate the
 * appointment a guest is relying on, so the change is refused and the operator
 * is told why. Cancelling or completing that booking first releases the slot and
 * makes it editable again.
 */
export async function updateSlot(
  slotId: number,
  input: { slotDate: ISODate; startTime: string; endTime: string; status: TimeSlot["status"] },
): Promise<WriteResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: ADMIN_KEY_MISSING };

  const active = await findActiveBooking(slotId);
  if (active) return { ok: false, error: BOOKED_BLOCKS_EDIT };

  const slot = await getSlot(slotId);
  if (!slot) return { ok: false, error: "ไม่พบช่วงเวลานี้" };

  const start = toTime(input.startTime);
  const end = toTime(input.endTime);

  if (!start || !end) return { ok: false, error: "รูปแบบเวลาไม่ถูกต้อง ต้องเป็น HH:MM" };
  if (end <= start) return { ok: false, error: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม" };

  const { data: sameDay, error: readError } = await supabase
    .from("time_slots")
    .select(SLOT_COLUMNS)
    .eq("slot_date", input.slotDate);

  if (readError) return { ok: false, error: readError.message };

  const candidate = { start_time: start, end_time: end };
  for (const other of (sameDay ?? []) as TimeSlot[]) {
    if (other.id === slotId) continue;
    if (overlaps(candidate, other)) {
      return {
        ok: false,
        error: `ช่วงเวลานี้มีอยู่แล้ว (${hhmm(other.start_time)} – ${hhmm(other.end_time)})`,
      };
    }
  }

  const { error } = await supabase
    .from("time_slots")
    .update({
      slot_date: input.slotDate,
      start_time: start,
      end_time: end,
      status: input.status,
    })
    .eq("id", slotId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/**
 * Deletes a slot, but only while nothing holds it (§6).
 *
 * The booking is never deleted along with it -- losing a guest's appointment to
 * tidy up a timeslot would be the worst possible outcome here. The FK is
 * ON DELETE RESTRICT as the backstop, but the operator gets the reason before
 * the database raises.
 */
export async function deleteSlot(slotId: number): Promise<WriteResult> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: ADMIN_KEY_MISSING };

  const active = await findActiveBooking(slotId);
  if (active) return { ok: false, error: BOOKED_BLOCKS_DELETE };

  const { error } = await supabase.from("time_slots").delete().eq("id", slotId);

  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: BOOKED_BLOCKS_DELETE };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** Half-open comparison: touching endpoints (10:00–10:30 / 10:30–11:00) do not overlap. */
function overlaps(
  a: { start_time: string; end_time: string },
  b: { start_time: string; end_time: string },
): boolean {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

function toTime(value: string): ClockTime | null {
  const m = HH_MM.exec(value.trim());
  return m ? `${m[1]}:${m[2]}:00` : null;
}

/** Turns a constraint violation into something the owner can act on (§16). */
function friendlyInsertError(error: { code?: string; message: string }): string {
  if (error.code === "23505" || error.code === "23P01") {
    return "ช่วงเวลานี้มีอยู่แล้ว";
  }
  return error.message;
}

export { isActiveBooking };
