"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toPng } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBookingWithNotification } from "@/app/actions/booking";
import { Button } from "@/components/ui/Button";
import { fetchAvailableStarts, fetchSlotDates } from "@/lib/supabase/client-queries";
import {
  bookingTouchesSlot,
  slotChangeTouchesDate,
  useBookingSignal,
  useTableChanges,
  type TableChange,
} from "@/lib/supabase/realtime";
import type { BookingStatus, ISODate, SlotWithAvailability } from "@/lib/supabase/types";
import {
  cn,
  formatTime12Hour,
  isValidThaiPhone,
  isLunchBreakSlot,
  normalizeThaiPhone,
  shopToday,
  slotHasStarted,
  toISODate,
  toLocalDate,
} from "@/lib/utils";

/** How far ahead the calendar may be opened. */
const MAX_DAYS_AHEAD = 60;

const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อ"] as const;

const SERVICES = [
  {
    key: "mens-haircut",
    name: "Men's Haircut",
    thaiName: "ตัดผมชาย",
    durationSlots: 1,
    detail: "Classic cut",
    description: "ทรงคลาสสิกที่เก็บรายละเอียดรอบกรอบหน้าและท้ายทอยอย่างพอดี",
    price: "฿100",
    eyebrow: "01 / CLASSIC",
    image: null,
  },
  {
    key: "volume-perm",
    name: "Volume Perm",
    thaiName: "ดัดวอลลุ่ม",
    durationSlots: 4,
    detail: "Natural volume & texture",
    description: "เพิ่มวอลลุ่มและรูปทรงให้เส้นผมดูมีมิติ พร้อม styling ที่ดูเป็นธรรมชาติ",
    price: "฿700–1,000",
    eyebrow: "02 / VOLUME",
    image: "/images/services/volume-perm.png",
  },
  {
    key: "curly-perm",
    name: "Curly Perm",
    thaiName: "ดัดหยิก",
    durationSlots: 4,
    detail: "Defined curls with character",
    description: "ลอนหยิกที่ชัดขึ้นแต่ยังคง movement ของเส้นผมและ texture ที่ดูสะอาด",
    price: "฿700–1,000",
    eyebrow: "03 / CURL",
    image: "/images/services/curly-perm.png",
  },
  {
    key: "messy-perm",
    name: "Messy Perm",
    thaiName: "ดัดเซอร์",
    durationSlots: 4,
    detail: "Effortless texture & movement",
    description: "เพิ่ม texture แบบเซอร์ ๆ ให้ทรงผมมี movement และจัดทรงได้ง่ายในทุกวัน",
    price: "฿700–1,000",
    eyebrow: "04 / MESSY",
    image: "/images/services/messy-perm.png",
  },
  {
    key: "down-perm",
    name: "Down Perm",
    thaiName: "ดาวน์เพิร์ม",
    durationSlots: null,
    detail: "Clean & controlled sides",
    description: "กดเส้นผมด้านข้างให้เข้าทรง เนี้ยบขึ้น และดูสมดุลกับรูปหน้า",
    price: "฿200–500",
    eyebrow: "05 / DOWN",
    image: "/images/services/down-perm.png",
  },
  {
    key: "up-perm",
    name: "Up Perm",
    thaiName: "อัพเพิร์ม",
    durationSlots: null,
    detail: "Lifted volume & definition",
    description: "ยกโคนและเพิ่ม form ให้ผมด้านบนดูมีทิศทางและมี volume มากขึ้น",
    price: "฿200–500",
    eyebrow: "06 / UP",
    image: "/images/services/up-perm.png",
  },
] as const;

type Service = (typeof SERVICES)[number];



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

function ServicePicker({
  selected,
  onSelect,
}: {
  selected: Service | null;
  onSelect: (service: Service | null) => void;
}) {
  return (
    <section id="services" aria-labelledby="pick-service" className="relative scroll-mt-6 overflow-hidden rounded-[1.75rem] border border-white/35 bg-ink-900 p-4 shadow-[0_18px_50px_-30px_#000] ring-1 ring-white/10 sm:p-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-white" />
      <div className="flex items-end justify-between gap-3 border-b border-white/20 pb-4">
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.25em] text-white/35 uppercase">OUR SERVICES</p>
          <h2 id="pick-service" className="mt-1 font-serif text-3xl tracking-[-0.04em] text-white">FIND YOUR STYLE. <span className="font-display text-base tracking-normal text-white/55">(เลือกบริการ)</span></h2>
        </div>
        {selected ? <span className="rounded-full bg-white px-3 py-1 text-[0.6rem] font-bold tracking-[0.15em] text-ink-950 uppercase">{selected.durationSlots === null ? "duration pending" : `${selected.durationSlots} slot${selected.durationSlots === 1 ? "" : "s"}`}</span> : <span className="rounded-full border border-white/30 px-3 py-1 text-[0.6rem] font-bold tracking-[0.15em] text-white/70 uppercase">Required</span>}
      </div>
      <div className="mt-4 grid gap-2 px-1 py-1">
        {SERVICES.map((service) => {
          const active = selected?.name === service.name;
          return (
            <motion.div
              key={service.name}
              layout
              className={cn(
                "w-full overflow-hidden rounded-2xl border text-left transition-colors duration-300",
                active
                  ? "border-white bg-white text-ink-950"
                  : "border-white/12 bg-ink-800 text-white hover:border-white/45",
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                aria-expanded={active}
                onClick={() => onSelect(active ? null : service)}
                className="flex min-h-[4.5rem] w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className={cn("block text-[0.6rem] font-bold tracking-[0.18em] uppercase", active ? "text-ink-950/50" : "text-white/35")}>
                    {service.eyebrow}
                  </span>
                  <span className="mt-1 block truncate font-display text-sm font-bold tracking-tight">{service.name}</span>
                  <span className={cn("mt-1 block truncate text-xs font-bold", active ? "text-ink-950/70" : "text-white/65")}>{service.thaiName}</span>
                  <span className={cn("mt-0.5 block truncate text-xs", active ? "text-ink-950/45" : "text-white/40")}>{service.detail}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className={cn("text-xs font-bold", active ? "text-ink-950" : "text-white/70")}>{service.price}</span>
                  <span aria-hidden className={cn("grid size-7 place-items-center rounded-full border text-lg font-light leading-none", active ? "border-ink-950/30" : "border-white/20")}>{active ? "−" : "+"}</span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {active ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                      <div className="border-t border-ink-950/15 p-3">
                        {service.image ? (
                          <div className="relative h-44 select-none overflow-visible rounded-xl bg-transparent touch-pan-y sm:h-52">
                            <Image
                              src={service.image}
                              alt={`${service.name} hairstyle reference`}
                              fill
                              sizes="(max-width: 640px) 78vw, (max-width: 1024px) 42vw, 29vw"
                              className="object-contain pointer-events-none"
                              draggable={false}
                            />
                            <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-2.5 py-1 text-[0.55rem] font-bold tracking-[0.16em] text-white uppercase">{service.name}</span>
                          </div>
                        ) : null}
                      <div className="px-1 pb-1 pt-3">
                        <p className={cn("text-sm leading-6", active ? "text-ink-950/65" : "text-white/60")}>{service.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
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
  selected: ISODate | "";
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
      <p className="mb-3 text-[0.6rem] font-bold tracking-[0.25em] text-white/45 uppercase">SELECT DATE <span className="font-display tracking-normal">/ เลือกวันที่</span></p>
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
        const formattedTime = formatTime12Hour(slot.start_time) ?? slot.start_time;
        const [clock, period] = formattedTime.split(" ");
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
            <span className="block text-base leading-none tabular-nums">{clock}</span>
            {period ? <span className="mt-1 block text-[0.6rem] font-bold tracking-[0.16em] opacity-60">{period}</span> : null}
            {disabled ? <span className="sr-only"> จองแล้ว</span> : null}
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * The whole guest experience: service -> date -> time -> name -> book.
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
  const [date, setDate] = useState<ISODate | null>(initialDate);
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
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [result, setResult] = useState<{
    name: string;
    phone: string;
    service: string;
    status: BookingStatus;
    time: string;
  } | null>(null);
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
  const serviceKeyRef = useRef<string | null>(null);
  useEffect(() => {
    serviceKeyRef.current = selectedService?.key ?? null;
  }, [selectedService]);

  const load = useCallback(async (iso: ISODate, serviceKey?: string | null) => {
    const ticket = ++requestId.current;

    setDay((prev) =>
      prev.date === iso ? { ...prev, loading: true, error: null } : prev,
    );

    const key = serviceKey ?? serviceKeyRef.current;
    if (!key) {
      if (ticket !== requestId.current) return;
      setDay({ date: iso, slots: [], bookedIds: [], totalAvailable: 0, loading: false, error: null });
      return;
    }

    const { slots, totalAvailable, error } = await fetchAvailableStarts(iso, key);

    if (ticket !== requestId.current) return; // superseded by a newer date

    setDay({
      date: iso,
      slots,
      bookedIds: [],
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

  const handleServiceSelect = useCallback(
    (service: Service | null) => {
      setSelectedService(service);
      if (date) void load(date, service?.key ?? null);
    },
    [date, load],
  );

  /**
   * Switching date clears the grid immediately, so the previous day's times are
   * never shown against the new heading while the read is in flight.
   */
  const handleDateChange = useCallback(
    (next: ISODate) => {
      if (next === date) {
        setDate(null);
        setDay((previous) => ({ ...previous, slots: [], bookedIds: [], loading: false, error: null }));
        return;
      }
      setDate(next);
      setDay({
        date: next,
        slots: [],
        bookedIds: [],
        totalAvailable: 0,
        loading: true,
        error: null,
      });
      void load(next, serviceKeyRef.current);
    },
    [date, load],
  );

  const slots = date && day.date === date ? day.slots : NO_SLOTS;
  const loading = date ? (day.date === date ? day.loading : true) : false;
  const loadError = date && day.date === date ? day.error : null;
  const totalAvailable = date && day.date === date ? day.totalAvailable : 0;

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
    return ids;
  }, [slots]);

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
      if (!date) return;
      if (!slotChangeTouchesDate(change, date, daySlotIds())) return;
      void load(date);
    },
    [date, daySlotIds, load],
  );

  useTableChanges(GUEST_WATCHED_TABLES, handleChange);

  useBookingSignal((timeSlotId) => {
    if (!date) return;
    if (!bookingTouchesSlot(timeSlotId, daySlotIds())) return;
    void load(date);
  });

  if (result) {
    return (
      <BookingSuccess
        result={result}
        date={date ?? initialDate}
        onClose={() => setResult(null)}
        onAgain={() => {
          setResult(null);
          setName("");
          setPhone("");
          setNameError(null);
          setPhoneError(null);
          setSelectedService(null);
          if (date) void load(date);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-1 border-y border-white/10 py-3 text-[0.55rem] font-bold tracking-[0.15em] text-white/35 uppercase sm:text-[0.65rem]">
        <span className="text-white">01 Date</span>
        <span>02 Time</span>
        <span>03 Service</span>
        <span className="text-right">04 Details</span>
      </div>
      <DateCalendar
        selected={date ?? ""}
        availableDates={availableDates}
        onSelect={handleDateChange}
      />

      {date ? <DayForm
        key={date}
        date={date}
        slots={slots}
        totalAvailable={totalAvailable}
        loading={loading}
        loadError={loadError}
        name={name}
        nameError={nameError}
        phone={phone}
        phoneError={phoneError}
        service={selectedService}
        onServiceSelect={handleServiceSelect}
        onNameChange={(value) => {
          setName(value);
          if (nameError) setNameError(null);
        }}
        onPhoneChange={(value) => {
          setPhone(value);
          if (phoneError) setPhoneError(null);
        }}
        onPhoneError={setPhoneError}
        onBooked={setResult}
        onSlotLost={() => void load(date)}
      /> : (
        <div className="rounded-3xl border border-white/20 bg-ink-900 px-4 py-8 text-center text-sm text-white/55">
          กรุณาเลือกวันที่เพื่อดูเวลาที่ว่าง
        </div>
      )}
    </div>
  );
}

/** Confirmation screen, shown only after the database accepted the insert. */
function BookingSuccess({
  result,
  date,
  onClose,
  onAgain,
}: {
  result: { name: string; phone: string; service: string; status: BookingStatus; time: string };
  date: ISODate;
  onClose: () => void;
  onAgain: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [captureState, setCaptureState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  async function captureBooking() {
    if (!cardRef.current) return;

    setCaptureState("working");
    setCaptureMessage(null);

    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#0b0b0b",
        cacheBust: true,
        pixelRatio: 2,
      });
      setPreview(dataUrl);

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "flook-booking-confirmation.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Flook Barber Shop booking",
          text: "Booking confirmation from Flook Barber Shop",
          files: [file],
        });
        setCaptureMessage("พร้อมส่งให้ช่างแล้ว");
      } else {
        const link = document.createElement("a");
        link.download = "flook-booking-confirmation.png";
        link.href = dataUrl;
        link.click();
        setCaptureMessage("บันทึกภาพคิวแล้ว");
      }
      setCaptureState("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setCaptureMessage("ยกเลิกการส่งแล้ว สามารถกดค้างที่รูปเพื่อบันทึกได้");
        setCaptureState("done");
        return;
      }
      console.error("[booking] confirmation capture failed:", error);
      setCaptureState("error");
      setCaptureMessage("สร้างภาพไม่สำเร็จ กดค้างที่การ์ดเพื่อบันทึกภาพ");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        tabIndex={-1}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative my-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-[1.75rem] border border-white/20 bg-ink-900 shadow-2xl shadow-black/60"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างยืนยันการจอง"
          className="absolute top-4 right-4 z-10 grid size-10 place-items-center rounded-full border border-white/20 text-xl text-white/70 transition-colors hover:bg-white hover:text-ink-950"
        >
          ×
        </button>

        <div className="w-full p-4 sm:p-6">
        <div className="mb-5 text-center">
          <div aria-hidden className="mx-auto grid size-14 place-items-center rounded-full border border-white/30 bg-white text-ink-950">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </div>
          <p className="mt-5 text-[0.65rem] font-bold tracking-[0.3em] text-white/45 uppercase">Flook Barber Shop</p>
          <h2 id="booking-success-title" className="mt-2 font-serif text-4xl tracking-[-0.05em] text-white sm:text-5xl">จองคิวสำเร็จ ✓</h2>
        </div>

        <article ref={cardRef} className="w-full rounded-[1.75rem] border border-white/20 bg-ink-950 p-5 text-left shadow-2xl shadow-black/40 sm:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-5">
            <div>
              <p className="text-[0.6rem] font-bold tracking-[0.25em] text-white/40 uppercase">Booking confirmation</p>
              <p className="mt-2 font-serif text-2xl text-white">Flook Barber Shop</p>
            </div>
            <span className="rounded-full border border-white/25 px-3 py-1 text-[0.6rem] font-bold tracking-[0.15em] text-white uppercase">{result.status.toUpperCase()}</span>
          </div>

          <dl className="mt-5 space-y-3">
            {[
              ["Name", result.name],
              ["Service", result.service],
              ["Date", longDateFormatter.format(new Date(`${date}T00:00:00`))],
              ["Time", result.time],
              ["Phone", result.phone],
              ["Status", result.status.toUpperCase()],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-2">
                <dt className="text-[0.65rem] font-bold tracking-[0.15em] text-white/40 uppercase">{label}</dt>
                <dd className="max-w-[65%] text-right text-sm font-bold text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-center text-[0.65rem] font-bold tracking-[0.22em] text-white/40 uppercase">See you in the chair.</p>
        </article>

        <div className="mt-5 space-y-3">
          <Button fullWidth size="lg" loading={captureState === "working"} onClick={() => void captureBooking()}>
            {captureState === "working" ? "กำลังสร้างภาพ..." : "บันทึกคิว"}
          </Button>
          {captureMessage ? <p role="status" className="text-center text-xs text-white/55">{captureMessage}</p> : null}
          {preview ? (
            <div className="rounded-2xl border border-white/10 bg-ink-900 p-2">
              <p className="px-2 pb-2 text-[0.6rem] font-bold tracking-[0.16em] text-white/35 uppercase">Preview · กดค้างที่รูปเพื่อบันทึก</p>
              <Image src={preview} alt="Booking confirmation preview" width={900} height={1200} unoptimized className="w-full rounded-xl" />
            </div>
          ) : null}
        </div>

        <section aria-labelledby="success-rules" className="mt-8 rounded-[1.5rem] border border-white/12 bg-ink-900 p-5 text-left">
          <h3 id="success-rules" className="font-serif text-2xl text-white">BEFORE YOUR APPOINTMENT</h3>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/60">
            <li>กรุณามาตรงตามเวลาที่จอง</li>
            <li>สามารถมาสายได้ไม่เกิน 15 นาที หลังจากนั้นทางร้านขอสงวนสิทธิ์ในการเลื่อนคิว</li>
            <li>หากไม่สามารถมาตามนัดได้ กรุณาแจ้งหรือขอเลื่อนคิวล่วงหน้า 2–3 ชั่วโมง</li>
            <li>ไม่มีค่ามัดจำ</li>
            <li>กรุณาตรวจสอบวันและเวลาก่อนยืนยันการจอง</li>
          </ol>
        </section>

        <Button variant="ghost" fullWidth className="mt-5" onClick={onAgain}>
          จองคิวเพิ่ม
        </Button>
        </div>
      </motion.section>
    </motion.div>
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
  phone,
  phoneError,
  service,
  onServiceSelect,
  onNameChange,
  onPhoneChange,
  onPhoneError,
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
  phone: string;
  phoneError: string | null;
  service: Service | null;
  onServiceSelect: (service: Service | null) => void;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneError: (message: string | null) => void;
  onBooked: (result: {
    name: string;
    phone: string;
    service: string;
    status: BookingStatus;
    time: string;
  }) => void;
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
    const serviceSlots = slots;
  const selectedSlot = selection
    ? (serviceSlots.find((slot) => Number(slot.id) === Number(selection.id)) ?? null)
    : null;

  const openCount = serviceSlots.filter((s) => !s.isBooked).length;
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

    if (!service) {
      inFlight.current = false;
      setSubmitError("กรุณาเลือกบริการก่อน");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      inFlight.current = false;
      onNameChange(trimmed);
      setSubmitError("กรุณากรอกชื่อของคุณ");
      return;
    }
    const normalizedPhone = normalizeThaiPhone(phone);
    if (!normalizedPhone) {
      inFlight.current = false;
      onPhoneError("กรุณากรอกเบอร์โทรศัพท์");
      setSubmitError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }
    if (!isValidThaiPhone(normalizedPhone)) {
      inFlight.current = false;
      onPhoneError("กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 080-521-1831");
      setSubmitError("กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 080-521-1831");
      return;
    }
    if (!selectedSlot) {
      inFlight.current = false;
      setSubmitError("กรุณาเลือกเวลาที่สะดวกก่อน");
      return;
    }

    // The grid may have been left open long enough for this slot to start.
    // Reject it locally before the RPC, while the database remains the final gate.
    if (isLunchBreakSlot(selectedSlot.start_time, selectedSlot.end_time)) {
      inFlight.current = false;
      setSubmitError("ช่วง 12:00–13:00 เป็นเวลาพักของร้าน กรุณาเลือกเวลาอื่น");
      setSelection(null);
      onSlotLost();
      return;
    }
    if (slotHasStarted(date, selectedSlot.start_time)) {
      inFlight.current = false;
      setSubmitError("เวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่");
      setSelection(null);
      onSlotLost();
      return;
    }

    setSubmitting(true);
    const res = await createBookingWithNotification({
      customerName: trimmed,
      customerPhone: normalizedPhone,
      timeSlotId: selectedSlot.id,
      serviceKey: service.key,
      bookingDate: longDate,
      bookingTime: formatTime12Hour(selectedSlot.start_time) ?? selectedSlot.start_time,
    });
    setSubmitting(false);
    inFlight.current = false;

    if (res.ok) {
      onBooked({
        name: trimmed,
        phone: normalizedPhone,
        service: service.name,
        status: res.status,
        time: formatTime12Hour(selectedSlot.start_time) ?? selectedSlot.start_time,
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

    if (res.reason === "phone_required") {
      onPhoneError("กรุณากรอกเบอร์โทรศัพท์");
      setSubmitError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    if (res.reason === "invalid_phone") {
      onPhoneError("กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 080-521-1831");
      setSubmitError("กรุณากรอกเบอร์มือถือไทย 10 หลัก เช่น 080-521-1831");
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
      <ServicePicker selected={service} onSelect={onServiceSelect} />

      <section aria-labelledby="pick-time" className="rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="pick-time" className="font-display text-base font-bold text-white">
            SELECT TIME <span className="text-sm font-normal text-white/55">/ เลือกเวลาที่สะดวก</span>
          </h2>
          <p className="font-display shrink-0 text-xs font-bold text-gold-500">
            {loading ? "…" : `ว่าง ${openCount} คิว`}
          </p>
        </div>

        <p className="mt-0.5 text-xs text-white/45">{longDate}</p>

        <div className="mt-3">
          {service && date ? (
            <SlotGrid
              slots={serviceSlots}
              date={date}
              totalAvailable={totalAvailable}
              selectedId={selectedSlot?.id ?? null}
              loading={loading}
              error={loadError}
              onSelect={(slot) => {
                if (selectedSlot && Number(selectedSlot.id) === Number(slot.id)) {
                  setSelection(null);
                  setSubmitError(null);
                  return;
                }
                if (isLunchBreakSlot(slot.start_time, slot.end_time)) {
                  setSubmitError("ช่วง 12:00–13:00 เป็นเวลาพักของร้าน กรุณาเลือกเวลาอื่น");
                  setSelection(null);
                  onSlotLost();
                  return;
                }
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
          ) : (
            <p className="rounded-2xl bg-ink-800 px-4 py-6 text-center text-sm text-white/50">
              {date ? "เลือกบริการเพื่อดูเวลาที่ว่าง" : "กรุณาเลือกวันที่ก่อน"}
            </p>
          )}
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative space-y-4 overflow-hidden rounded-3xl border border-white/30 bg-ink-900 p-4 shadow-[0_18px_50px_-30px_#000] ring-1 ring-white/10 sm:p-6"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-white" />
        <div className="flex items-end justify-between gap-3 border-b border-white/20 pb-4">
          <div>
            <p className="text-[0.6rem] font-bold tracking-[0.25em] text-white/45 uppercase">04 / Customer details</p>
          <h2 className="mt-1 font-serif text-2xl tracking-[-0.03em] text-white">YOUR DETAILS <span className="font-display text-base tracking-normal text-white/55">/ ข้อมูลสำหรับจองคิว</span></h2>
          </div>
          <span className="rounded-full border border-white/30 px-2.5 py-1 text-[0.6rem] font-bold tracking-[0.12em] text-white/70 uppercase">Required</span>
        </div>
        {selectedSlot ? (
          <div className="rounded-2xl bg-green-800 px-4 py-3">
            <p className="font-display text-sm font-bold text-white">วันที่ {longDate}</p>
            <p className="font-display mt-0.5 text-sm font-bold text-gold-400">
              เวลา {formatTime12Hour(selectedSlot.start_time) ?? selectedSlot.start_time}
            </p>
          </div>
        ) : null}

        <div>
          <label htmlFor="customer-name" className="flex items-center justify-between gap-2 font-display text-sm font-bold text-white">
            <span>YOUR NAME <span className="font-display text-sm font-normal text-white/60">/ ชื่อของคุณ</span></span><span className="text-[0.6rem] font-bold tracking-[0.12em] text-white/40 uppercase">Required</span>
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
            className="mt-1.5 min-h-12 w-full max-w-full rounded-2xl bg-ink-800 px-4 text-base text-white ring-1 ring-white/25 placeholder:text-white/30 focus:ring-2 focus:ring-white focus:outline-none"
          />
          {nameError ? (
            <p id="customer-name-error" className="mt-1.5 text-sm font-medium text-danger">
              {nameError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="customer-phone" className="flex items-center justify-between gap-2 font-display text-sm font-bold text-white">
            <span>PHONE NUMBER <span className="font-display text-sm font-normal text-white/60">/ เบอร์โทรศัพท์</span></span><span className="text-[0.6rem] font-bold tracking-[0.12em] text-white/40 uppercase">Required</span>
          </label>
          <input
            id="customer-phone"
            name="customer_phone"
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="เช่น 080-521-1831"
            autoComplete="tel"
            inputMode="tel"
            maxLength={15}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? "customer-phone-error" : undefined}
            className="mt-1.5 min-h-12 w-full max-w-full rounded-2xl bg-ink-800 px-4 text-base text-white ring-1 ring-white/25 placeholder:text-white/30 focus:ring-2 focus:ring-white focus:outline-none"
          />
          {phoneError ? (
            <p id="customer-phone-error" className="mt-1.5 text-sm font-medium text-danger">
              {phoneError}
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
          BOOK NOW
        </Button>
      </form>
    </>
  );
}
