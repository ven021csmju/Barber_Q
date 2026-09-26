"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdminSignedIn, clearAdminSession } from "@/lib/admin-auth";
import {
  createSlots,
  deleteSlot,
  setBookingStatus,
  setSlotBlocked,
  updateSlot,
} from "@/lib/supabase/mutations";
import type {
  BookingStatus,
  BookingWithRefs,
  ISODate,
  TimeSlotStatus,
} from "@/lib/supabase/types";
import { getBookings, getSlotOverview, type SlotOverviewRow } from "@/lib/supabase/queries";

/**
 * Admin Server Actions.
 *
 * Every action re-checks the passcode session. A Server Action is just an HTTP
 * endpoint that Next exposes, so guarding only in the layout would leave these
 * callable by anyone who knew the URL.
 */

export interface ActionState {
  error: string | null;
  ok: boolean;
}

export interface SearchResult {
  ok: boolean;
  error: string | null;
  data: BookingWithRefs[];
}

/**
 * Backing read for the booking browser.
 *
 * A Server Action rather than a direct client query, because `bookings` is not
 * readable by the `anon` role: sending it from the browser would hand every
 * guest's name to anyone who opened devtools.
 */
export async function searchBookings(filter: {
  date?: ISODate;
  nameQuery?: string;
  status?: BookingStatus;
}): Promise<SearchResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง", data: [] };
  }

  const result = await getBookings({
    date: filter.date,
    nameQuery: filter.nameQuery,
    status: filter.status ? [filter.status] : undefined,
  });

  return { ok: result.ok, error: result.error, data: result.data };
}

async function requireAdmin(): Promise<boolean> {
  return isAdminSignedIn();
}

export interface SlotListResult {
  ok: boolean;
  error: string | null;
  data: SlotOverviewRow[];
}

/**
 * Backing read for the slot manager when the operator switches date.
 *
 * Returns slots already joined to their active booking, so the screen can tell
 * available / blocked / booked apart without a second round trip.
 */
export async function loadSlotOverviewForDate(date: ISODate): Promise<SlotListResult> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง", data: [] };
  }

  const result = await getSlotOverview(date);
  return { ok: result.ok, error: result.error, data: result.data };
}

export async function changeBookingStatus(
  bookingId: number,
  status: BookingStatus,
): Promise<ActionState> {
  if (!(await requireAdmin())) return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const result = await setBookingStatus(bookingId, status);
  revalidateSlotAndBookingPaths();
  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error ?? "อัปเดตสถานะไม่สำเร็จ" };
}

export async function toggleSlotBlocked(
  slotId: number,
  blocked: boolean,
): Promise<ActionState> {
  if (!(await requireAdmin())) return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const result = await setSlotBlocked(slotId, blocked);
  revalidateSlotAndBookingPaths();
  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error ?? "อัปเดตช่วงเวลาไม่สำเร็จ" };
}

export async function addSlots(input: {
  slotDate: ISODate;
  times: { startTime: string; endTime: string }[];
}): Promise<ActionState> {
  if (!(await requireAdmin())) return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const result = await createSlots(input);
  revalidateSlotAndBookingPaths();
  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error ?? "เพิ่มช่วงเวลาไม่สำเร็จ" };
}

/** Edit an existing slot. Refused while an active booking holds it. */
export async function saveSlot(
  slotId: number,
  input: { slotDate: ISODate; startTime: string; endTime: string; status: TimeSlotStatus },
): Promise<ActionState> {
  if (!(await requireAdmin())) return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const result = await updateSlot(slotId, input);
  revalidateSlotAndBookingPaths();
  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error ?? "แก้ไขช่วงเวลาไม่สำเร็จ" };
}

export async function removeSlot(slotId: number): Promise<ActionState> {
  if (!(await requireAdmin())) return { ok: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };

  const result = await deleteSlot(slotId);
  revalidateSlotAndBookingPaths();
  return result.ok
    ? { ok: true, error: null }
    : { ok: false, error: result.error ?? "ลบช่วงเวลาไม่สำเร็จ" };
}

/**
 * A slot change can move what the dashboard counts and what the booking list
 * shows, so both are revalidated on every write rather than only the page the
 * operator happens to be on (§17).
 */
function revalidateSlotAndBookingPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/time-slots");
  revalidatePath("/admin/slots");
}

export async function signOut(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
