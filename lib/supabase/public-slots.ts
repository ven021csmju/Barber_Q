import "server-only";

import { createClient } from "./server";
import type { ISODate, SlotWithAvailability } from "./types";
import { isLunchBreakSlot, removeStartedSlots } from "@/lib/utils";

/**
 * Public availability, read on the server with the publishable key.
 *
 * Used for the first paint of the homepage so the guest sees real slots without
 * waiting on a client round trip. It runs as `anon`, so the RLS policies in
 * `supabase/migrations/20260926000000_guest_booking.sql` do the filtering:
 * blocked slots are not returned at all, and the RPC reveals booked slot ids
 * without ever exposing a guest name.
 */
export async function getPublicAvailability(
  date: ISODate,
): Promise<{ slots: SlotWithAvailability[]; totalAvailable: number; error: string | null }> {
  const supabase = await createClient();
  if (!supabase) {
    return { slots: [], totalAvailable: 0, error: "ยังไม่ได้ตั้งค่า Supabase" };
  }

  // `status = 'available'` is applied here as well as in the RLS policy, so the
  // grid is correct even if the policy is ever widened.
  const { data, error } = await supabase
    .from("time_slots")
    .select("id,slot_date,start_time,end_time,status,created_at")
    .eq("slot_date", date)
    .eq("status", "available")
    .order("start_time", { ascending: true });

  if (error) {
    // Surfaced, never swallowed: an empty list here would render as
    // "no free times" and hide a real permissions or network failure.
    console.error("[booking] time_slots query failed:", error);
    return { slots: [], totalAvailable: 0, error: error.message };
  }

  const { data: booked, error: bookedError } = await supabase.rpc("booked_slot_ids", {
    p_date: date,
  });

  if (bookedError) {
    console.error("[booking] booked_slot_ids failed:", bookedError);
    return { slots: [], totalAvailable: 0, error: bookedError.message };
  }

  // The RPC returns rows of shape { time_slot_id }, NOT bare ids. Reading
  // `.time_slot_id` matters: mapping the row object straight into `Number()`
  // yields NaN, which made every booked slot look bookable.
  const taken = new Set(
    ((booked ?? []) as { time_slot_id: number }[]).map((row) => Number(row.time_slot_id)),
  );

  const available = ((data ?? []) as SlotWithAvailability[])
    .filter((slot) => !isLunchBreakSlot(slot.start_time, slot.end_time))
    .map((slot) => ({
      ...slot,
      isBooked: taken.has(Number(slot.id)),
    }));
  const free = available.filter((slot) => !slot.isBooked);

  return {
    slots: removeStartedSlots(free, date),
    totalAvailable: free.length,
    error: null,
  };
}
