/** Tiny classnames joiner — no dependency needed. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
});

/** 150 -> "150 บาท" */
export function formatPrice(value: number) {
  return `${bahtFormatter.format(value)} บาท`;
}

/** 45 -> "45 นาที" */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} ชั่วโมง` : `${hours} ชั่วโมง ${rest} นาที`;
}

const thaiDateLong = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const thaiDateShort = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
});

const weekdayShort = new Intl.DateTimeFormat("th-TH", { weekday: "short" });

/** "2026-09-28" -> "28 กันยายน 2569" (Thai Buddhist calendar, local time) */
export function formatThaiDate(iso: string) {
  return thaiDateLong.format(toLocalDate(iso));
}

export function formatThaiDateShort(iso: string) {
  return thaiDateShort.format(toLocalDate(iso));
}

export function formatWeekday(iso: string) {
  return weekdayShort.format(toLocalDate(iso));
}

/** Build a local Date from a bare "YYYY-MM-DD" (avoids UTC off-by-one). */
export function toLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Local "YYYY-MM-DD" for a Date. */
export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "09:00" or "09:00:00" -> minutes since midnight, for sorting / overlap checks. */
export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** The shop is closed for lunch from 12:00 through 13:00. */
export function isLunchBreakSlot(startTime: string, endTime: string): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start < 13 * 60 && end > 12 * 60;
}

/** Normalise a Thai mobile number to the ten-digit form stored by the RPC. */
export function normalizeThaiPhone(value: string): string {
  return value.trim().replace(/[^0-9]/g, "");
}

export function isValidThaiPhone(value: string): boolean {
  return /^0[689][0-9]{8}$/.test(normalizeThaiPhone(value));
}

/* ------------------------------------------------------------------ *
 * shop time (Asia/Bangkok)
 *
 * "Today" and "what time is it" are questions about the shop, not about the
 * machine asking. A guest booking from another timezone, or a server whose
 * TZ is not set, would otherwise resolve both against its own offset and
 * disagree with the shop by a day or seven hours.
 *
 * So the shop clock is read through Intl, which is correct for any host
 * timezone, and deliberately never via `toISOString()` -- that converts to
 * UTC first, which is exactly the shift this avoids. The shop date also has
 * to agree with the `timezone('Asia/Bangkok', now())` the database RPC uses.
 * ------------------------------------------------------------------ */

const SHOP_TIME_ZONE = "Asia/Bangkok";

const shopFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Shop-local calendar date and minutes-since-midnight for one instant. */
export function shopClock(now: Date = new Date()): { date: string; minutes: number } {
  const parts = shopFormatter.formatToParts(now);
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(read("hour"));
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    // Some ICU builds render midnight as hour 24 under h23; normalise it.
    minutes: (hour % 24) * 60 + Number(read("minute")),
  };
}

/** Shop-local "YYYY-MM-DD" for right now. */
export function shopToday(now: Date = new Date()): string {
  return shopClock(now).date;
}

/**
 * Whether a slot can no longer be picked, per the shop's rule:
 * a slot that has already started (`start_time <= now`) is not selectable.
 *
 * A past date is past in full, and a future date has not started at all, so
 * only the shop's own today is compared against the clock.
 */
export function slotHasStarted(
  iso: string,
  startTime: string,
  now: Date = new Date(),
): boolean {
  const { date, minutes } = shopClock(now);
  if (iso < date) return true;
  if (iso > date) return false;
  return timeToMinutes(startTime) <= minutes;
}

/**
 * Drops slots that have already started, keeping the order the query returned
 * (which is `start_time` ascending). Only affects the shop's today.
 */
export function removeStartedSlots<T extends { start_time: string }>(
  slots: T[],
  iso: string,
  now: Date = new Date(),
): T[] {
  if (iso !== shopToday(now)) return slots;
  return slots.filter((slot) => !slotHasStarted(iso, slot.start_time, now));
}

/**
 * Postgres `time` comes back as "09:00:00". The UI shows "9:00".
 */
export function formatClockTime(time: string | null | undefined) {
  if (!time) return null;
  const [h, m] = time.split(":");
  if (h === undefined) return time;
  const hour = h.replace(/^0+(?=\d)/, "");
  return m === "00" || m === undefined ? hour : `${hour}:${m}`;
}

/** Presentation-only 12-hour time for customer-facing slot buttons. */
export function formatTime12Hour(time: string | null | undefined) {
  if (!time) return null;
  const [rawHour, rawMinute] = time.split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour) || rawMinute === undefined) return time;

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${rawMinute} ${suffix}`;
}

/* ------------------------------------------------------------------ *
 * status
 *
 * `bookings.status` and `barbers.status` are plain `text` in the database, not
 * enums, and the tables are empty so the real values could not be observed.
 * Mapping is therefore tolerant: the values the app writes are recognised,
 * and anything else is shown verbatim rather than being dropped or throwing.
 * ------------------------------------------------------------------ */

export type StatusTone = "warning" | "success" | "neutral" | "danger";

const BOOKING_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "รอยืนยัน", tone: "warning" },
  confirmed: { label: "ยืนยันแล้ว", tone: "success" },
  completed: { label: "เสร็จสิ้น", tone: "neutral" },
  cancelled: { label: "ยกเลิกแล้ว", tone: "danger" },
  canceled: { label: "ยกเลิกแล้ว", tone: "danger" },
};

export function bookingStatusMeta(status: string | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  const key = (status ?? "").trim();
  if (!key) return { label: "ไม่ระบุ", tone: "neutral" };

  const known = BOOKING_STATUS_MAP[key.toLowerCase()];
  if (known) return known;

  // Unrecognised value: surface it as-is instead of pretending it is pending.
  return { label: key, tone: "neutral" };
}

/** The values this app writes; used for filtering and transitions. */
export const APP_BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

const BARBER_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  available: { label: "พร้อมให้บริการ", tone: "success" },
  busy: { label: "กำลังให้บริการ", tone: "warning" },
  off: { label: "วันนี้หยุด", tone: "neutral" },
};

export function barberStatusMeta(status: string | null | undefined): {
  label: string;
  tone: StatusTone;
} {
  const key = (status ?? "").trim();
  if (!key) return { label: "ไม่ระบุ", tone: "neutral" };
  return BARBER_STATUS_MAP[key.toLowerCase()] ?? { label: key, tone: "neutral" };
}

/** Statuses a customer may still cancel. Unknown values are not cancellable. */
export function canCancelBooking(status: string | null | undefined) {
  const key = (status ?? "").trim().toLowerCase();
  return key === "pending" || key === "confirmed";
}
