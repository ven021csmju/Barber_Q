"use client";

import { useRouter } from "next/navigation";
import { useBookingSignal, useTableChanges } from "@/lib/supabase/realtime";

/**
 * Keeps the dashboard honest without a refresh button.
 *
 * The dashboard is a Server Component: it reads today's counters and queue with
 * the secret key through `getDashboardStats` / `getAllBookings`, which are the
 * only place a guest name is allowed to come from. So rather than teach a client
 * component to compute those numbers -- a second implementation of rules that
 * already exist on the server -- this asks Next to re-render the route.
 *
 * `router.refresh()` re-runs the server component and its existing loaders under
 * the same admin session check. No new action, no new data path, no contract
 * change, and `force-dynamic` is already set on the page.
 *
 * Bookings arrive as a broadcast signal, not a table change: this component holds
 * only the publishable key, so it is the `anon` role and is refused every
 * `bookings` row. `time_slots` is a genuine table change and the owner can read
 * it, so both are listened for -- the counters track slots as well as bookings.
 *
 * No date filtering is applied and none is needed: the dashboard shows today's
 * queue alongside totals for every slot, so a change anywhere is potentially
 * visible. Events are rare -- a few per day -- and a refresh is idempotent, so an
 * occasional back-to-back pair simply renders twice.
 */
export function DashboardLiveRefresh() {
  const router = useRouter();

  useBookingSignal(() => router.refresh());
  useTableChanges([{ table: "time_slots" }], () => router.refresh());

  return null;
}
