"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime subscription helper.
 *
 * The database is the source of truth; this only asks to be told when it moved,
 * so a screen that has gone stale corrects itself. Nothing here decides
 * availability -- every subscriber re-runs the loader it already uses, so
 * `time_slots` + `booked_slot_ids()` remain the only authority on what is free.
 *
 * The rules for "is this change about what I am showing?" live in
 * `./realtime-match`, deliberately apart from this file so they carry no React
 * and no client dependency. Re-exported here so a screen needs one import.
 *
 * Design notes:
 *  - One channel per hook instance, created inside an effect keyed by a *stable
 *    string* of the table list. Passing the array straight into the deps would
 *    give it a new identity every render and rebuild the channel every render.
 *  - The caller's callback is held in a ref and refreshed after each render, so
 *    passing an inline arrow function does not churn the subscription.
 *  - Failure is logged and swallowed. Realtime is an enhancement: if the socket
 *    never opens, booking still works and `create_booking()` is still what
 *    settles a contested slot.
 *  - No polling, no interval, no retry loop. This is the Realtime WebSocket.
 */

export {
  bookingChangeTouchesSlot,
  bookingTouchesSlot,
  changedId,
  slotChangeTouchesDate,
  type TableChange,
} from "./realtime-match";

import { type TableChange } from "./realtime-match";

export type { TableChange as RealtimeChange };

/**
 * The broadcast topic the database announces booking changes on.
 *
 * Why a topic and not a table subscription: `bookings` is granted to nobody but
 * the SECURITY DEFINER functions, and Realtime Postgres Changes evaluates RLS as
 * the subscribing role. So an `anon` browser -- which is the only kind of client
 * that can run in a guest's tab, and the only kind allowed in this app's bundle
 * -- is refused every `bookings` row, and adding the table to the publication
 * would not change that. The refusal is the security design working, not a gap.
 *
 * A broadcast sidesteps it without loosening anything: the payload names a slot
 * id and nothing else. That is not new information, since `booked_slot_ids()`
 * already hands every guest the ids of the taken slots for a date. Guest names
 * and notes must never be put in this payload.
 *
 * Requires a database trigger to send; see the migration notes. Until it exists
 * the subscription is inert and the app behaves exactly as it did before.
 */
export const BOOKING_SIGNAL_TOPIC = "aphidet:booking-signal";

export const BOOKING_SIGNAL_EVENT = "booking_changed";

export type RealtimeTable = { table: string; schema?: string };

function tableKey(entry: RealtimeTable): string {
  return `${entry.schema ?? "public"}.${entry.table}`;
}

/**
 * Distinguishes one subscription from another.
 *
 * Not cosmetic. `removeChannel()` is asynchronous, and a remount -- which React's
 * StrictMode does deliberately in development, and Fast Refresh does constantly --
 * creates the next channel before the previous one has finished leaving. When both
 * share a topic name, `supabase.channel()` hands back the channel that is on its
 * way out, and subscribing to that cannot succeed: the join is refused and the
 * status comes back CHANNEL_ERROR. Giving each instance its own topic means a
 * leaving channel and a live one can never be the same channel.
 */
let subscriptionCount = 0;
function nextSubscriptionId(): number {
  subscriptionCount += 1;
  return subscriptionCount;
}

/**
 * Reports a subscription's outcome, once each way.
 *
 * Silence is the worst option here, because the two states that matter look
 * identical without it: "joined, but nothing is arriving because the database
 * trigger does not exist yet" and "never joined at all". Those need different
 * fixes, and the join is the only thing the client can actually report -- once
 * SUBSCRIBED, whether a change ever arrives is the database's business.
 *
 * `CLOSED` is deliberately not a failure. It is what a channel reports when React
 * tears it down, which StrictMode does on every mount in development, so treating
 * it as an error would print a failure on every page load. A socket that drops
 * mid-session surfaces as CHANNEL_ERROR or TIMED_OUT, and realtime-js reconnects
 * on its own.
 *
 * Success and failure are tracked separately so a late recovery is still reported
 * after an early failure, and neither can flood the console.
 */
const reportedFailures = new Set<string>();
const reportedJoins = new Set<string>();

function reportSubscribeOutcome(
  what: string,
  ok: boolean,
  status: string,
  err: unknown,
  state: string,
) {
  if (ok) {
    if (reportedJoins.has(what)) return;
    reportedJoins.add(what);
    console.log(`[realtime] ${what}: joined`);
    return;
  }
  if (reportedFailures.has(what)) return;
  reportedFailures.add(what);
  const reason = err instanceof Error ? err.message : err;
  console.error(
    `[realtime] ${what}: ${status}`,
    reason ? `— ${reason}` : "(no error given)",
    `(channel state: ${state})`,
  );
}

/**
 * Calls `onChange` for every INSERT / UPDATE / DELETE on the given tables.
 *
 * The callback receives the raw payload so the caller can decide whether the
 * change concerns the day it is currently showing, and skip the reload if not.
 */
export function useTableChanges(
  tables: RealtimeTable[],
  onChange: (change: TableChange) => void,
): void {
  // Sorted + joined: a stable dependency that survives new array identities.
  const key = tables.map(tableKey).sort().join(",");

  // Assigned once per mounted instance and stable across StrictMode's deliberate
  // double-mount, so both halves of that cycle share a topic and never collide.
  const [instance] = useState(nextSubscriptionId);

  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    const entries = key.split(",").filter(Boolean);
    if (entries.length === 0) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error("[realtime] no Supabase client — realtime disabled");
      return;
    }

    const channel = supabase.channel(`aphidet:${entries.join("-")}#${instance}`);

    for (const entry of entries) {
      const [schema, table] = entry.split(".");
      channel.on(
        "postgres_changes",
        { event: "*", schema, table },
        (payload) => {
          latest.current({
            table,
            eventType: payload.eventType,
            new: (payload.new ?? {}) as Record<string, unknown>,
            old: (payload.old ?? {}) as Record<string, unknown>,
          });
        },
      );
    }

    channel.subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reportSubscribeOutcome(
          `table changes (${entries.join(", ")})`,
          false,
          status,
          err,
          channel.state,
        );
        return;
      }      if (status === "SUBSCRIBED") {
        reportSubscribeOutcome(
          `table changes (${entries.join(", ")})`,
          true,
          status,
          err,
          channel.state,
        );
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [key, instance]);
}

/**
 * Calls `onChange` with the id of a slot whose booking just changed.
 *
 * Deliberately narrow: the caller learns *which* slot, then re-runs whatever
 * loader it already uses. Nothing about the booking itself is passed on -- no
 * status, no name, no note -- because the only question being asked is "does this
 * concern the screen in front of me?".
 *
 * Paired with `bookingTouchesSlot` so a table change and a broadcast signal are
 * filtered by the same rule.
 */
export function useBookingSignal(onSlotChanged: (timeSlotId: number) => void): void {
  const latest = useRef(onSlotChanged);
  useEffect(() => {
    latest.current = onSlotChanged;
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error("[realtime] no Supabase client — booking signal disabled");
      return;
    }

    const channel = supabase
      // Exactly the topic the database trigger publishes to. It must not be
      // suffixed or otherwise decorated: Realtime matches broadcast topics
      // exactly, so `aphidet:booking-signal#3` would never see a message sent to
      // `aphidet:booking-signal`. Several subscribers on one topic is normal and
      // correct, and a remount re-joining is handled by supabase-js.
      .channel(BOOKING_SIGNAL_TOPIC)
      .on("broadcast", { event: BOOKING_SIGNAL_EVENT }, (message) => {
        // Validate the shape and nothing more. Whether this slot is on the
        // screen is the caller's question, and it already holds the day's ids.
        const raw = (message.payload as { time_slot_id?: unknown } | undefined)?.time_slot_id;
        const slotId = Number(raw);
        if (!Number.isFinite(slotId) || slotId <= 0) return;
        latest.current(slotId);
      })
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Non-fatal: booking still works, it just will not self-update.
          reportSubscribeOutcome("booking signal", false, status, err, channel.state);
          return;
        }
        if (status === "SUBSCRIBED") {
          reportSubscribeOutcome("booking signal", true, status, err, channel.state);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
