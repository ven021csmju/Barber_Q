/**
 * "Did this change concern the day on screen?"
 *
 * Pure, dependency-free, and deliberately separate from the hook in
 * `./realtime`. These are the rules that decide whether a screen reloads or stays
 * put, and they are the part most likely to be wrong in a way that is invisible
 * until a guest is told a taken time is free. Keeping them free of React and of
 * the Supabase client means they can be exercised directly, without a browser
 * and without a Realtime publication.
 *
 * The shape of the problem is fixed by what Postgres Changes actually delivers:
 * an INSERT and an UPDATE carry the changed columns on both `new` and `old`, but
 * a DELETE carries only the primary key. So a change that can be answered by its
 * own row is answered that way, and a DELETE is answered by asking whether the
 * id is one the screen is already showing.
 */

/** Minimal shape of a Postgres Changes payload. */
export type TableChange = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

/** Reads a numeric column off either side of the change (DELETE only has `old`). */
export function changedId(change: TableChange, column: string): number | null {
  const raw = change.new?.[column] ?? change.old?.[column];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Whether a `time_slots` change concerns `date`.
 *
 * Both sides are compared, so a slot moved from this day to another still
 * refreshes the day it left -- otherwise the guest keeps a time that is no longer
 * on that schedule.
 *
 * A DELETE has no `slot_date` to compare, so it is tested against the ids on
 * screen. That is exact for the case a guest can actually notice: the owner
 * removing a time they are looking at. A delete on some other day is ignored.
 *
 * @param onScreenSlotIds ids of the slots currently rendered for that day
 */
export function slotChangeTouchesDate(
  change: TableChange,
  date: string,
  onScreenSlotIds: ReadonlySet<number>,
): boolean {
  const newDate = change.new?.slot_date;
  const oldDate = change.old?.slot_date;

  if (newDate === undefined && oldDate === undefined) {
    const id = changedId(change, "id");
    return id !== null && onScreenSlotIds.has(id);
  }

  return String(newDate ?? "") === date || String(oldDate ?? "") === date;
}

/**
 * Whether a slot id belongs to the day being shown.
 *
 * The one place that question is answered, whether the id arrived as a Postgres
 * Change or as a broadcast signal.
 *
 * The caller must hold *both* kinds of id for the day. A cancellation names a
 * slot that is no longer being offered, and that is exactly the event that has to
 * put it back on the grid -- so an available-only set would miss it.
 */
export function bookingTouchesSlot(
  slotId: unknown,
  daySlotIds: ReadonlySet<number>,
): boolean {
  const id = Number(slotId);
  return Number.isFinite(id) && id > 0 && daySlotIds.has(id);
}

/**
 * Whether a `bookings` Postgres Change names a slot on the day being shown.
 *
 * A booking row has no date of its own; it points at a `time_slot_id`, so the
 * day has to be identified from the ids the screen already holds. `time_slot_id`
 * is never updated in place, so reading `new` first costs nothing.
 */
export function bookingChangeTouchesSlot(
  change: TableChange,
  daySlotIds: ReadonlySet<number>,
): boolean {
  return bookingTouchesSlot(change.new?.time_slot_id ?? change.old?.time_slot_id, daySlotIds);
}
