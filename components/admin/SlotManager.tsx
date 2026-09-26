"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ReadError } from "@/components/ui/Feedback";
import { formatThaiDate } from "@/lib/utils";
import {
  bookingTouchesSlot,
  slotChangeTouchesDate,
  useBookingSignal,
  useTableChanges,
} from "@/lib/supabase/realtime";
import type { ISODate, TimeSlotStatus } from "@/lib/supabase/types";
import type { SlotOverviewRow } from "@/lib/supabase/queries";

/**
 * Slot management for one date.
 *
 * Three states have to be told apart, and only two of them are stored:
 *
 *   ว่าง     available -- on sale, nobody has it
 *   ปิดคิว   blocked   -- the owner pulled it; the row and its history stay
 *   จองแล้ว  derived   -- a `pending` or `confirmed` booking holds it
 *
 * "booked" is never written to `time_slots.status`. A completed or cancelled
 * booking is not a hold, so those times show as ว่าง again.
 *
 * A slot a guest is holding is frozen here as well as on the server: no edit, no
 * delete, no block. The server refuses regardless -- this only saves the owner
 * from clicking something that will bounce.
 */
export function SlotManager({
  initialDate,
  dates,
  initialRows,
  error: initialError,
}: {
  initialDate: ISODate;
  dates: ISODate[];
  initialRows: SlotOverviewRow[];
  error: string | null;
}) {
  const [date, setDate] = useState<ISODate>(initialDate);
  const [rows, setRows] = useState<SlotOverviewRow[]>(initialRows);
  const [error, setError] = useState<string | null>(initialError);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("10:30");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("10:00");
  const [editEnd, setEditEnd] = useState("10:30");
  const [editDate, setEditDate] = useState<ISODate>(initialDate);
  const [editStatus, setEditStatus] = useState<TimeSlotStatus>("available");

  async function loadRows(nextDate: ISODate) {
    setDate(nextDate);
    setBusy(true);
    setError(null);

    // Reached through the "use server" directive, so Next swaps this for a
    // server reference and the secret key never enters the client bundle.
    const { loadSlotOverviewForDate } = await import("@/app/admin/(dash)/actions");
    const result = await loadSlotOverviewForDate(nextDate);

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "โหลดช่วงเวลาไม่สำเร็จ");
      return;
    }
    setRows(result.data);
  }

  /**
   * Ids of the slots rendered for the day on screen, read at the moment a change
   * arrives rather than captured now, so a refresh that lands mid-search cannot
   * compare against rows that have already been replaced.
   */
  const onScreen = useCallback(
    () => new Set(rows.map((row) => row.slot.id)),
    [rows],
  );

  /**
   * Keeps the day on screen honest when someone else acts on it.
   *
   * `time_slots` is a real table change: the owner blocking, moving, adding or
   * removing a time is a change to that table, and the guest policy already lets
   * this client read it.
   *
   * A booking is a broadcast signal, not a table change. This component runs in a
   * browser holding only the publishable key, so it is the `anon` role -- which
   * cannot read `bookings`, and would get no table change even if the table were
   * published. Watching it is not redundant anyway: a row here shows whether the
   * slot is held and by whom, and that is derived from `bookings`, since booked is
   * never written back onto `time_slots`.
   *
   * Either way the handler only decides *whether the day changed* and then re-runs
   * the same loader used everywhere else. Guest names come from
   * `loadSlotOverviewForDate`, which re-checks the admin session on every call --
   * never from a payload.
   */
  useTableChanges([{ table: "time_slots" }], (change) => {
    if (!slotChangeTouchesDate(change, date, onScreen())) return;
    void loadRows(date);
  });

  useBookingSignal((timeSlotId) => {
    if (!bookingTouchesSlot(timeSlotId, onScreen())) return;
    void loadRows(date);
  });

  async function add() {
    setBusy(true);
    setError(null);

    const { addSlots } = await import("@/app/admin/(dash)/actions");
    const result = await addSlots({ slotDate: date, times: [{ startTime, endTime }] });

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "ไม่สามารถสร้างช่วงเวลาได้");
      return;
    }
    // Reload so the new row comes back with its real id and booking state.
    await loadRows(date);
  }

  function startEdit(row: SlotOverviewRow) {
    setEditingId(row.slot.id);
    setEditStart(row.slot.start_time.slice(0, 5));
    setEditEnd(row.slot.end_time.slice(0, 5));
    setEditDate(row.slot.slot_date);
    setEditStatus(row.slot.status);
    setError(null);
  }

  async function saveEdit(slotId: number) {
    setBusy(true);
    setError(null);

    const { saveSlot } = await import("@/app/admin/(dash)/actions");
    const result = await saveSlot(slotId, {
      slotDate: editDate,
      startTime: editStart,
      endTime: editEnd,
      status: editStatus,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "แก้ไขช่วงเวลาไม่สำเร็จ");
      return;
    }
    setEditingId(null);
    await loadRows(date);
  }

  async function toggle(row: SlotOverviewRow) {
    const blocking = row.slot.status === "available";
    setError(null);

    const { toggleSlotBlocked } = await import("@/app/admin/(dash)/actions");
    const result = await toggleSlotBlocked(row.slot.id, blocking);

    if (!result.ok) {
      setError(result.error ?? "อัปเดตช่วงเวลาไม่สำเร็จ");
      return;
    }
    // Reloaded rather than patched locally: the server owns this state and a
    // partial update would drift from what the database actually stored.
    await loadRows(date);
  }

  async function remove(row: SlotOverviewRow) {
    setError(null);

    const { removeSlot } = await import("@/app/admin/(dash)/actions");
    const result = await removeSlot(row.slot.id);

    if (!result.ok) {
      setError(result.error ?? "ลบช่วงเวลาไม่สำเร็จ");
      return;
    }
    setRows((list) => list.filter((r) => r.slot.id !== row.slot.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10">
        <div className="min-w-0 flex-1">
          <label htmlFor="slot-date" className="font-display block text-xs font-bold text-white/60">
            วันที่
          </label>
          <input
            id="slot-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && void loadRows(e.target.value)}
            list="known-slot-dates"
            className="mt-1 min-h-11 w-full rounded-2xl bg-ink-800 px-3.5 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
          />
          <datalist id="known-slot-dates">
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatThaiDate(d)}
              </option>
            ))}
          </datalist>
        </div>

        <p className="font-display text-sm font-bold text-gold-500">{formatThaiDate(date)}</p>
      </div>

      {error ? <ReadError error={error} /> : null}

      <div className="rounded-3xl bg-ink-900 p-4 ring-1 ring-white/10">
        <p className="font-display text-sm font-bold text-white">เพิ่มช่วงเวลา</p>
        <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
          <div>
            <label htmlFor="start" className="block text-xs text-white/50">
              เริ่ม
            </label>
            <input
              id="start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 min-h-11 rounded-2xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="end" className="block text-xs text-white/50">
              สิ้นสุด
            </label>
            <input
              id="end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 min-h-11 rounded-2xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
            />
          </div>
          <Button onClick={() => void add()} loading={busy} disabled={busy}>
            เพิ่มช่วงเวลา
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-3xl bg-ink-900 px-4 py-8 text-center text-sm text-white/45 ring-1 ring-white/10">
          ยังไม่มีช่วงเวลาในวันนี้
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {rows.map((row) => {
            const { slot, isBooked, booking } = row;
            const blocked = slot.status === "blocked";
            const range = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;

            return (
              <li
                key={slot.id}
                className="rounded-2xl bg-ink-900 px-3.5 py-3 ring-1 ring-white/10"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-white tabular-nums">{range}</p>
                    <p className="text-[0.65rem] text-white/35">
                      #{slot.id}
                      {booking ? ` · ${booking.customer_name}` : ""}
                    </p>
                  </div>

                  {/* Booked wins over blocked: a guest holding the slot is the
                      fact the owner needs, whatever the row's own status says. */}
                  {isBooked ? (
                    <Badge tone="info">จองแล้ว</Badge>
                  ) : blocked ? (
                    <Badge tone="danger">ปิดคิว</Badge>
                  ) : (
                    <Badge tone="success">ว่าง</Badge>
                  )}

                  <div className="flex shrink-0 gap-1.5">
                    <RowAction
                      onClick={() => startEdit(row)}
                      disabled={isBooked}
                      title={isBooked ? "คิวนี้มีการจองอยู่ ไม่สามารถแก้ไขหรือลบได้" : undefined}
                    >
                      แก้ไข
                    </RowAction>

                    <RowAction
                      onClick={() => void toggle(row)}
                      disabled={isBooked && !blocked}
                      title={
                        isBooked && !blocked
                          ? "คิวนี้มีการจองอยู่ ไม่สามารถปิดคิวได้"
                          : undefined
                      }
                    >
                      {blocked ? "เปิดคิว" : "ปิดคิว"}
                    </RowAction>

                    <RowAction
                      onClick={() => void remove(row)}
                      disabled={isBooked}
                      danger
                      title={isBooked ? "ไม่สามารถลบคิวที่มีการจองได้" : undefined}
                    >
                      ลบ
                    </RowAction>
                  </div>
                </div>

                {editingId === slot.id ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2.5 border-t border-white/10 pt-3">
                    <div>
                      <label
                        htmlFor={`edit-date-${slot.id}`}
                        className="block text-xs text-white/50"
                      >
                        วันที่
                      </label>
                      <input
                        id={`edit-date-${slot.id}`}
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="mt-1 min-h-11 rounded-2xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-start-${slot.id}`}
                        className="block text-xs text-white/50"
                      >
                        เริ่ม
                      </label>
                      <input
                        id={`edit-start-${slot.id}`}
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="mt-1 min-h-11 rounded-2xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-end-${slot.id}`} className="block text-xs text-white/50">
                        สิ้นสุด
                      </label>
                      <input
                        id={`edit-end-${slot.id}`}
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="mt-1 min-h-11 rounded-2xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-status-${slot.id}`}
                        className="block text-xs text-white/50"
                      >
                        สถานะ
                      </label>
                      <select
                        id={`edit-status-${slot.id}`}
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as TimeSlotStatus)}
                        className="mt-1 min-h-11 rounded-2xl bg-ink-800 px-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-gold-500 focus:outline-none"
                      >
                        <option value="available">ว่าง</option>
                        <option value="blocked">ปิดคิว</option>
                      </select>
                    </div>

                    <Button onClick={() => void saveEdit(slot.id)} loading={busy} disabled={busy}>
                      บันทึก
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)} disabled={busy}>
                      ยกเลิก
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Small pill action. `title` explains why a frozen control is unavailable. */
function RowAction({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "min-h-9 rounded-full px-3 text-xs font-bold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-35",
        danger
          ? "bg-ink-800 text-white/60 enabled:hover:bg-danger enabled:hover:text-white"
          : "bg-ink-800 text-white/70 enabled:hover:bg-gold-500 enabled:hover:text-ink-950",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
