"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createBooking, fetchAvailability, fetchSlotDates } from "@/lib/supabase/client-queries";
import {
  bookingTouchesSlot,
  slotChangeTouchesDate,
  useBookingSignal,
  useTableChanges,
  type TableChange,
} from "@/lib/supabase/realtime";
import type { ISODate, SlotWithAvailability } from "@/lib/supabase/types";
import {
  cn,
  formatClockTime,
  shopToday,
  slotHasStarted,
  toISODate,
  toLocalDate,
} from "@/lib/utils";

/** How far ahead the calendar may be opened. */
const MAX_DAYS_AHEAD = 60;

const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อ"] as const;

const monthFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function startOfToday(): Date {
  return toLocalDate(shopToday());
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * What the guest screen listens to.
 *
 * Bookings arrive as a broadcast signal rather than a table change. `bookings`
 * is granted to nobody but the SECURITY DEFINER functions, and Realtime
 * Postgres Changes evaluates RLS as the subscribing role, so an `anon` tab is
 * refused every booking row -- by design, because those rows hold guest names.
 * The signal names a slot id and nothing else, which `booked_slot_ids()` already
 * tells every guest anyway. See `BOOKING_SIGNAL_TOPIC` for the full reasoning.
 *
 * `time_slots` is a real table change, and it is watched because the owner
 * adding a time, moving one, or editing a time on sale changes what a guest can
 * book. It carries no personal data, so listening to it exposes nothing new.
 *
 * One known limit: the guest policy on `time_slots` is
 * `using (status = 'available')`, so an owner *blocking* a slot produces a row
 * the guest can no longer see, and Realtime does not deliver it. A blocked slot
 * is still handled correctly when the guest tries it -- the create_booking
 * refusal re-reads the grid -- but it is not pushed. Closing that needs the
 * broadcast trigger on `time_slots` as well; see the migration notes.
 */
const GUEST_WATCHED_TABLES = [{ table: "time_slots" }];

/**
 * Shared stand-ins for "this day has not been loaded".
 *
 * Module-level on purpose. A literal `[]` here would be a new array on every
 * render, which quietly invalidates any hook that depends on it and defeats the
 * point of the request-ticket check.
 */
const NO_SLOTS: SlotWithAvailability[] = [];
const NO_BOOKED_IDS: number[] = [];

/**
 * Month calendar.
 *
 * A plain 7-column grid: at 360px the widest cell is still ~44px, so it fits
 * without a horizontal scroller and without fixed-width cells.
 */
function DateCalendar({
  selected,
  availableDates,
  onSelect,
}: {
  selected: ISODate;
  availableDates: Set<ISODate>;
  onSelect: (iso: ISODate) => void;
}) {
  const reduceMotion = useReducedMotion();
  const today = useMemo(() => startOfToday(), []);
  const maxDate = useMemo(() => {
    const d = startOfToday();
    d.setDate(d.getDate() + MAX_DAYS_AHEAD);
    return d;
  }, []);
  const [viewMonth, setViewMonth] = useState(() => startOfToday());

  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    // JS weeks start on Sunday; the Thai short labels above start on Monday.
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(
      viewMonth.getFullYear(),
      viewMonth.getMonth() + 1,
      0,
    ).getDate();

    const out: (Date | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      out.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewMonth]);

  const canGoBack = viewMonth.getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const canGoForward =
    viewMonth.getTime() < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1).getTime();

  return (
    <section aria-labelledby="pick-date" className="rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          disabled={!canGoBack}
          aria-label="เดือนก่อนหน้า"
          className="grid size-11 place-items-center rounded-2xl bg-green-800 text-white transition-colors hover:bg-green-700 disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 5.5 8 12l6.5 6.5" />
          </svg>
        </button>

        <h2
          id="pick-date"
          className="font-display text-base font-bold text-white"
          aria-live="polite"
        >
          {monthFormatter.format(viewMonth)}
        </h2>

        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={!canGoForward}
          aria-label="เดือนถัดไป"
          className="grid size-11 place-items-center rounded-2xl bg-green-800 text-white transition-colors hover:bg-green-700 disabled:opacity-30"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 5.5 6.5 6.5-6.5 6.5" />
          </svg>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1" role="grid">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={`${label}-${i}`}
            role="columnheader"
            aria-label={label}
            className="py-1 text-center text-[0.7rem] font-bold text-white/40"
          >
            {label}
          </div>
        ))}

        {cells.map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} aria-hidden className="aspect-square" />;
          }

          const iso = toISODate(date);
          const disabled = date < today || date > maxDate;
          const isToday = isSameDay(date, today);
          const hasSlots = availableDates.has(iso);
          const active = iso === selected;

          return (
            <motion.button
              key={iso}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-selected={active}
              aria-label={longDateFormatter.format(date)}
              onClick={() => onSelect(iso)}
              whileTap={reduceMotion || disabled ? undefined : { scale: 0.9 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className={cn(
                "relative grid aspect-square place-items-center rounded-xl text-sm font-bold transition-colors",
                active
                  ? "bg-gold-500 text-ink-950"
                  : disabled
                    ? "text-white/20"
                    : "text-white hover:bg-green-800",
              )}
            >
              {date.getDate()}
              {(isToday || hasSlots) && !active ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1 size-1 rounded-full",
                    hasSlots ? "bg-gold-500" : "bg-gold-500/70",
                  )}
                />
              ) : null}
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

/** The time grid: 3 columns, every cell inside the viewport. */
function SlotGrid({
  slots,
  date,
  totalAvailable,
  selectedId,
  loading,
  error,
  onSelect,
}: {
  slots: SlotWithAvailability[];
  date: ISODate;
  totalAvailable: number;
  selectedId: number | null;
  loading: boolean;
  error: string | null;
  onSelect: (slot: SlotWithAvailability) => void;
}) {
  const reduceMotion = useReducedMotion();

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-medium text-danger"
      >
        โหลดเวลาที่ว่างไม่สำเร็จ: {error}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-800" />
        ))}
        <span className="sr-only">กำลังโหลดเวลาที่ว่าง</span>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-2xl bg-ink-800 px-4 py-6 text-center text-sm text-white/50">
        {date === shopToday()
          ? totalAvailable === 0
            ? "วันนี้ไม่มีคิวว่าง"
            : "เวลาสำหรับวันนี้ผ่านไปแล้ว ลองเลือกวันที่อื่น"
          : "วันที่นี้ยังไม่มีช่วงเวลาว่าง ลองเลือกวันที่อื่น"}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="เลือกเวลา">
      {slots.map((slot) => {
        const time = formatClockTime(slot.start_time) ?? slot.start_time;
        const disabled = slot.isBooked;
        const active = slot.id === selectedId;

        return (
          <motion.button
            key={slot.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onSelect(slot)}
            whileTap={reduceMotion || disabled ? undefined : { scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={cn(
              "min-h-12 rounded-xl px-1 py-2.5 text-sm font-bold transition-colors",
              active
                ? "bg-gold-500 text-ink-950"
                : disabled
                  ? "bg-ink-800 text-white/25"
                  : "bg-green-800 text-white hover:bg-green-700",
            )}
          >
            {time}
            {disabled ? <span className="sr-only"> จองแล้ว</span> : null}
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * The whole guest experience: date -> time -> name -> book.
 *
 * There is no account, no wizard and no extra screen. Availability arrives
 * pre-rendered from the server, and is re-read from the database on every date
 * change and again after a rejected booking, so the grid can never show
 * something the database has already refused.
 *
 * State is split deliberately. The parent owns the date, the fetched slots and
 * the guest's name; the keyed `DayForm` below owns the chosen time. Keying by
 * date means a slot picked on one day can never survive a switch to another,
 * with no effect needed to enforce it.
 */
export function BookingWidget({
  initialDate,
  initialSlots,
  initialTotalAvailable,
  initialError = null,
}: {
  initialDate: ISODate;
  initialSlots: SlotWithAvailability[];
  initialTotalAvailable: number;
  initialError?: string | null;
}) {
  const [date, setDate] = useState<ISODate>(initialDate);
  const [day, setDay] = useState<{
     date: ISODate;
     slots: SlotWithAvailability[];
     bookedIds: number[];
     totalAvailable: number;
     loading: boolean;
     error: string | null;
   }>({
     date: initialDate,
     slots: initialSlots,
     bookedIds: [],
     totalAvailable: initialTotalAvailable,
     loading: false,
     error: initialError,
   });

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; time: string } | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<ISODate>>(
    () => (initialSlots.length > 0 ? new Set([initialDate]) : new Set()),
  );

  useEffect(() => {
    const from = shopToday();
    const toDate = toLocalDate(from);
    toDate.setDate(toDate.getDate() + MAX_DAYS_AHEAD);
    void fetchSlotDates(from, toISODate(toDate)).then((dates) => {
      setAvailableDates(new Set(dates));
    });
  }, []);

  /**
   * Monotonic request id. Every load takes a ticket, and a response may only
   * write state if it still holds the newest one. Without this, a slow read for
   * an earlier date can land after a later one and repaint the grid with the
   * wrong day -- the guest would tap a time that is not for the date shown.
   */
  const requestId = useRef(0);

  /**
   * Fetches one date's availability.
   *
   * The result is stamped with the date it belongs to and carries the ticket it
   * was issued, so a response the guest has already navigated away from is
   * discarded instead of overwriting the grid with the wrong day.
   */
  const load = useCallback(async (iso: ISODate) => {
    const ticket = ++requestId.current;

    setDay((prev) =>
      prev.date === iso ? { ...prev, loading: true, error: null } : prev,
    );

    const { slots, bookedIds, totalAvailable, error } = await fetchAvailability(iso);

    if (ticket !== requestId.current) return; // superseded by a newer date

    setDay({
      date: iso,
      slots,
      bookedIds,
      totalAvailable,
      loading: false,
      error,
    });
    if (slots.length > 0) {
      setAvailableDates((previous) => {
        const next = new Set(previous);
        next.add(iso);
        return next;
      });
    }
  }, []);

  /**
   * Switching date clears the grid immediately, so the previous day's times are
   * never shown against the new heading while the read is in flight.
   */
  const handleDateChange = useCallback(
    (next: ISODate) => {
      if (next === date) return;
      setDate(next);
      setDay({
        date: next,
        slots: [],
        bookedIds: [],
        totalAvailable: 0,
        loading: true,
        error: null,
      });
      void load(next);
    },
    [date, load],
  );

  const slots = day.date === date ? day.slots : NO_SLOTS;
  const bookedIds = day.date === date ? day.bookedIds : NO_BOOKED_IDS;
  const loading = day.date === date ? day.loading : true;
  const loadError = day.date === date ? day.error : null;
  const totalAvailable = day.date === date ? day.totalAvailable : 0;

  /**
   * Every slot id belonging to the day on screen -- the free ones we can offer,
   * plus the ones `booked_slot_ids()` already holds.
   *
   * Both halves are needed. A booking change names only a slot id, never a date,
   * so this is how "is this about the day I am looking at?" is answered. If it
   * held only the free slots, a cancellation -- the one change that must put a
   * time back on sale -- would name a slot that is not in the list, and the grid
   * would keep showing it as gone.
   *
   * A function rather than a value so it is read at the moment a change arrives,
   * against whatever the grid holds then. `useTableChanges` and `useBookingSignal`
   * both always call the newest version, so it cannot go stale.
   */
  const daySlotIds = useCallback(() => {
    const ids = new Set<number>();
    for (const slot of slots) ids.add(Number(slot.id));
    for (const id of bookedIds) ids.add(Number(id));
    return ids;
  }, [slots, bookedIds]);

  /**
   * Reloads when the database moved underneath the day on screen, and stays put
   * when it did not.
   *
   * The handler decides *whether* a change is relevant and then hands off to the
   * same `load` used for everything else. It never works out which slots are
   * free: that answer only ever comes from `fetchAvailability`, so there is one
   * implementation of the rule rather than two that can drift apart.
   */
  const handleChange = useCallback(
    (change: TableChange) => {
      if (!slotChangeTouchesDate(change, date, daySlotIds())) return;
      void load(date);
    },
    [date, daySlotIds, load],
  );

  useTableChanges(GUEST_WATCHED_TABLES, handleChange);

  useBookingSignal((timeSlotId) => {
    if (!bookingTouchesSlot(timeSlotId, daySlotIds())) return;
    void load(date);
  });

  if (result) {
    return <BookingSuccess result={result} date={date} onAgain={() => {
      setResult(null);
      setName("");
      void load(date);
    }} />;
  }

  return (
    <div className="space-y-4">
      <DateCalendar
        selected={date}
        availableDates={availableDates}
        onSelect={handleDateChange}
      />

      <DayForm
        key={date}
        date={date}
        slots={slots}
        totalAvailable={totalAvailable}
        loading={loading}
        loadError={loadError}
        name={name}
        nameError={nameError}
        onNameChange={(value) => {
          setName(value);
          if (nameError) setNameError(null);
        }}
        onBooked={setResult}
        onSlotLost={() => void load(date)}
      />
    </div>
  );
}

/** Confirmation screen, shown only after the database accepted the insert. */
function BookingSuccess({
  result,
  date,
  onAgain,
}: {
  result: { name: string; time: string };
  date: ISODate;
  onAgain: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-3xl bg-green-800 p-6 text-center ring-1 ring-gold-500/40"
    >
      <div
        aria-hidden
        className="mx-auto grid size-14 -rotate-3 place-items-center rounded-full bg-gold-500 text-ink-950"
      >
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </div>

      <h2 className="font-display mt-4 text-2xl font-bold text-white">จองคิวสำเร็จ ✓</h2>

      <dl className="mx-auto mt-4 max-w-xs space-y-2 text-left">
        {[
          ["ชื่อ", result.name],
          ["วันที่", longDateFormatter.format(new Date(`${date}T00:00:00`))],
          ["เวลา", result.time],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-xl bg-ink-950/40 px-4 py-2.5"
          >
            <dt className="text-sm text-white/60">{label}</dt>
            <dd className="font-display truncate text-sm font-bold text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="font-display mt-5 text-lg font-bold text-gold-500">แล้วพบกันครับ</p>

      <Button variant="ghost" fullWidth className="mt-5" onClick={onAgain}>
        จองคิวเพิ่ม
      </Button>
    </motion.section>
  );
}

/**
 * Time grid plus name field for a single date.
 *
 * Owns the chosen slot, the in-flight submit and the submit error, so all three
 * reset together the moment the parent changes the date's key.
 */
function DayForm({
  date,
  slots,
  totalAvailable,
  loading,
  loadError,
  name,
  nameError,
  onNameChange,
  onBooked,
  onSlotLost,
}: {
  date: ISODate;
  slots: SlotWithAvailability[];
  totalAvailable: number;
  loading: boolean;
  loadError: string | null;
  name: string;
  nameError: string | null;
  onNameChange: (value: string) => void;
  onBooked: (result: { name: string; time: string }) => void;
  onSlotLost: () => void;
}) {
  const [selection, setSelection] = useState<SlotWithAvailability | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * The chosen time, resolved against the slots currently on screen.
   *
   * Derived rather than stored-and-cleared, because it has to stay honest while
   * somebody else is booking. When the grid reloads and the tapped time is no
   * longer in it, this becomes `null` on the same render -- the chip disappears
   * and "ยืนยันการจอง" goes with it. An effect that cleared a stored copy would
   * leave the button live for a frame, and would have to fight the render pass
   * to do it.
   *
   * Resolving to the object from `slots` rather than the stored one also means an
   * owner editing the time while the guest is choosing is reflected immediately.
   */
  const selectedSlot = selection
    ? (slots.find((slot) => Number(slot.id) === Number(selection.id)) ?? null)
    : null;

  const openCount = slots.filter((s) => !s.isBooked).length;
  const longDate = longDateFormatter.format(new Date(`${date}T00:00:00`));

  /**
   * Synchronous in-flight flag. `submitting` state only reaches the button after
   * React re-renders, so a fast double-tap (or an Enter-key repeat) could fire
   * two submits in that window: the first would book, the second would come back
   * "already taken", and the guest would be shown a failure for a booking that
   * actually succeeded. A ref is checked immediately, with no render in between.
   */
  const inFlight = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (inFlight.current) return;
    inFlight.current = true;

    setSubmitError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      inFlight.current = false;
      onNameChange(trimmed);
      setSubmitError("กรุณากรอกชื่อของคุณ");
      return;
    }
    if (!selectedSlot) {
      inFlight.current = false;
      setSubmitError("กรุณาเลือกเวลาที่สะดวกก่อน");
      return;
    }

    // The grid may have been left open long enough for this slot to start.
    // Reject it locally before the RPC, while the database remains the final gate.
    if (slotHasStarted(date, selectedSlot.start_time)) {
      inFlight.current = false;
      setSubmitError("เวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่");
      setSelection(null);
      onSlotLost();
      return;
    }

    setSubmitting(true);
    const res = await createBooking({
      customerName: trimmed,
      timeSlotId: selectedSlot.id,
    });
    setSubmitting(false);
    inFlight.current = false;

    if (res.ok) {
      onBooked({
        name: trimmed,
        time: formatClockTime(selectedSlot.start_time) ?? selectedSlot.start_time,
      });
      return;
    }

    // `taken` is the database saying another guest won the slot. `blocked` and
    // `not_found` mean the shop closed or removed the slot -- either way the
    // grid on screen is stale, so re-read it rather than guessing.
    if (res.reason === "taken" || res.reason === "blocked" || res.reason === "not_found") {
      setSubmitError("ขออภัย คิวนี้ถูกจองไปแล้ว");
      setSelection(null);
      onSlotLost();
      return;
    }

    if (res.reason === "invalid_name") {
      setSubmitError("กรุณากรอกชื่อของคุณ");
      return;
    }

    if (res.reason === "expired") {
      setSubmitError("เวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่");
      setSelection(null);
      onSlotLost();
      return;
    }

    setSubmitError(
      res.reason === "config"
        ? "ยังไม่ได้ตั้งค่าระบบ กรุณาติดต่อทางร้าน"
        : "จองคิวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
    );
  }

  return (
    <>
      <section aria-labelledby="pick-time" className="rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="pick-time" className="font-display text-base font-bold text-white">
            เวลาที่ว่าง
          </h2>
          <p className="font-display shrink-0 text-xs font-bold text-gold-500">
            {loading ? "…" : `ว่าง ${openCount} คิว`}
          </p>
        </div>

        <p className="mt-0.5 text-xs text-white/45">{longDate}</p>

        <div className="mt-3">
          <SlotGrid
            slots={slots}
            date={date}
            totalAvailable={totalAvailable}
            selectedId={selectedSlot?.id ?? null}
            loading={loading}
            error={loadError}
            onSelect={(slot) => {
              if (slotHasStarted(date, slot.start_time)) {
                setSubmitError("เวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่");
                setSelection(null);
                onSlotLost();
                return;
              }
              setSubmitError(null);
              setSelection(slot);
            }}
          />
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10"
      >
        {selectedSlot ? (
          <div className="rounded-2xl bg-green-800 px-4 py-3">
            <p className="font-display text-sm font-bold text-white">วันที่ {longDate}</p>
            <p className="font-display mt-0.5 text-sm font-bold text-gold-400">
              เวลา {formatClockTime(selectedSlot.start_time) ?? selectedSlot.start_time}
            </p>
          </div>
        ) : null}

        <div>
          <label htmlFor="customer-name" className="font-display block text-sm font-bold text-white">
            ชื่อของคุณ
          </label>
          <input
            id="customer-name"
            name="customer_name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="กรอกชื่อ"
            autoComplete="name"
            maxLength={120}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "customer-name-error" : undefined}
            className="mt-1.5 min-h-12 w-full max-w-full rounded-2xl bg-ink-800 px-4 text-base text-white ring-1 ring-white/12 placeholder:text-white/30 focus:ring-2 focus:ring-gold-500 focus:outline-none"
          />
          {nameError ? (
            <p id="customer-name-error" className="mt-1.5 text-sm font-medium text-danger">
              {nameError}
            </p>
          ) : null}
        </div>

        {submitError ? (
          <p role="alert" className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-bold text-danger">
            {submitError}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!selectedSlot || loading}
        >
          จองคิว
        </Button>
      </form>
    </>
  );
}
