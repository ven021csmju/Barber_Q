"use server";

import { createClient } from "@/lib/supabase/server";
import { sendBookingNotification } from "@/lib/line/notification";
import { formatThaiDate, formatTime12Hour, normalizeThaiPhone } from "@/lib/utils";
import type { BookingStatus } from "@/lib/supabase/types";

export type ServerBookingFailure =
  | "taken" | "blocked" | "not_found" | "invalid_name" | "phone_required"
  | "invalid_phone" | "expired" | "config" | "error";

export type ServerBookingResult =
  | { ok: true; bookingId: number; status: BookingStatus }
  | { ok: false; reason: ServerBookingFailure };

function reasonFromRpcError(error: unknown): ServerBookingFailure {
  const message = typeof error === "object" && error !== null
    ? String((error as { message?: unknown }).message ?? "")
    : String(error ?? "");
  const reasons: Record<string, ServerBookingFailure> = {
    TIME_SLOT_ALREADY_BOOKED: "taken",
    TIME_SLOT_BLOCKED: "blocked",
    TIME_SLOT_NOT_AVAILABLE: "blocked",
    TIME_SLOT_NOT_FOUND: "not_found",
    CUSTOMER_NAME_REQUIRED: "invalid_name",
    CUSTOMER_PHONE_REQUIRED: "phone_required",
    INVALID_CUSTOMER_PHONE: "invalid_phone",
    TIME_SLOT_EXPIRED: "expired",
  };
  return reasons[message.trim().toUpperCase()] ?? "error";
}

function bookingStatus(value: unknown): BookingStatus {
  return value === "confirmed" || value === "completed" || value === "cancelled"
    ? value
    : "pending";
}

/** The only server-side booking write path. LINE is notified only after the RPC succeeds. */
export async function createBookingWithNotification(input: {
  customerName: string;
  customerPhone: string;
  timeSlotId: number;
  serviceName?: string | null;
  bookingDate: string;
  bookingTime: string;
}): Promise<ServerBookingResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, reason: "config" };

  const normalizedPhone = normalizeThaiPhone(input.customerPhone);
  const { data, error } = await supabase.rpc("create_booking", {
    p_customer_name: input.customerName.trim(),
    p_customer_phone: normalizedPhone,
    p_time_slot_id: input.timeSlotId,
  });

  if (error) {
    console.error("[booking] create_booking RPC failed");
    return { ok: false, reason: reasonFromRpcError(error) };
  }
  if (!data) return { ok: false, reason: "error" };

  const status = bookingStatus((data as { status?: unknown }).status);
  const bookingId = Number((data as { id?: unknown }).id) || 0;
  let bookingDate = input.bookingDate;
  let bookingTime = input.bookingTime;

  const { data: slot } = await supabase
    .from("time_slots")
    .select("slot_date,start_time")
    .eq("id", input.timeSlotId)
    .maybeSingle();
  if (slot?.slot_date) bookingDate = formatThaiDate(slot.slot_date);
  if (slot?.start_time) bookingTime = formatTime12Hour(slot.start_time) ?? input.bookingTime;

  try {
    await sendBookingNotification({
      customerName: input.customerName.trim(),
      customerPhone: normalizedPhone,
      serviceName: input.serviceName,
      bookingDate,
      bookingTime,
      status,
    });
  } catch {
    console.error("[LINE] booking notification failed after booking success");
  }

  return { ok: true, bookingId, status };
}
