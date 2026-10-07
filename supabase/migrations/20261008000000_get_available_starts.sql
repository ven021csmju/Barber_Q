-- =============================================================================
-- Phase 1: get_available_starts(p_date, p_service_key)
--
-- Returns ONLY valid START time_slots for a service, accounting for multi-slot
-- services (1 slot = 30 min). Occupancy is derived from BOTH the legacy
-- bookings.time_slot_id AND the new booking_slots.time_slot_id, so legacy
-- bookings (#56) and multi-slot bookings (#58) are both respected.
--
-- Idempotent: CREATE OR REPLACE. Does not touch tables, RLS, or other RPCs
-- (create_booking_v2 and booked_slot_ids are intentionally left untouched).
-- =============================================================================

create or replace function public.get_available_starts(
    p_date date,
    p_service_key text
)
returns table (
    time_slot_id bigint,
    start_time   time,
    end_time     time
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_dur      int;
    v_req      int;
    v_occupied bigint[];
    r          record;
    cur_start  time;
    srv_end    time;
    i          int;
    ok         boolean;
begin
    -- 1. SERVICE LOOKUP (source of truth). Reject unknown / inactive.
    select duration_minutes
      into v_dur
      from public.services
     where service_key = p_service_key
       and status = 'active';

    if not found then
        raise exception 'SERVICE_NOT_FOUND';
    end if;

    -- 2. REQUIRED SLOTS = ceil(duration_minutes / 30)
    v_req := ceil(v_dur::numeric / 30);

    -- 3. OCCUPANCY SET (UNION of legacy starting slot + booking_slots rows),
    --    only for ACTIVE bookings, scoped to the requested date.
    select coalesce(array_agg(distinct t.id), array[]::bigint[])
      into v_occupied
      from public.time_slots t
     where t.slot_date = p_date
       and t.id in (
           select b.time_slot_id
             from public.bookings b
            where b.status in ('pending', 'confirmed', 'completed')
              and b.time_slot_id is not null
           union
           select bs.time_slot_id
             from public.booking_slots bs
             join public.bookings b2 on b2.id = bs.booking_id
            where b2.status in ('pending', 'confirmed', 'completed')
       );

    -- 4 + 5 + 6. For every free, available slot, test it as a START:
    --    - all required consecutive 30-min slots must EXIST (same date,
    --      start_time chained by 30-min intervals -- never by id+1),
    --    - each must be available AND unoccupied,
    --    - none may start inside the 12:00-13:00 lunch break,
    --    - the whole service must end by 21:00.
    for r in
        select t.id, t.start_time, t.end_time
          from public.time_slots t
         where t.slot_date = p_date
           and t.status = 'available'
           and not (t.id = any(v_occupied))
         order by t.start_time
    loop
        ok := true;
        cur_start := r.start_time;
        srv_end := r.start_time + (v_dur || ' minutes')::interval;

        -- business hours: service must finish by 21:00
        if srv_end > '21:00'::time then
            continue;
        end if;

        for i in 1..v_req loop
            -- consecutive slot must exist, be available, and be free
            perform 1
               from public.time_slots t2
              where t2.slot_date = p_date
                and t2.start_time = cur_start
                and t2.status = 'available'
                and not (t2.id = any(v_occupied));

            if not found then
                ok := false;
                exit;
            end if;

            -- lunch break: no required slot may start in 12:00-13:00
            if cur_start >= '12:00'::time and cur_start < '13:00'::time then
                ok := false;
                exit;
            end if;

            cur_start := cur_start + interval '30 minutes';
        end loop;

        if ok then
            time_slot_id := r.id;
            start_time := r.start_time;
            end_time := srv_end;
            return next;
        end if;
    end loop;
end;
$$;

comment on function public.get_available_starts(date, text) is
    'Valid START time_slots for a service, multi-slot aware. Occupancy = legacy bookings.time_slot_id UNION booking_slots.time_slot_id.';

-- 10. SECURITY: SECURITY DEFINER already set above. Narrow execute grants so
--     anon/authenticated can call it, but PUBLIC (and therefore the raw role)
--     cannot. Table RLS is NOT changed.
revoke execute on function public.get_available_starts(date, text) from public;
grant execute on function public.get_available_starts(date, text) to anon, authenticated;

-- =============================================================================
-- Verification (READ-ONLY) — run after applying. Uses real data only.
--   Test 1 mens-haircut:  slot 100 (booking #57) must NOT appear.
--   Test 2 volume-perm:    09:00/09:30/10:00/10:30 (overlap #58) must NOT appear.
--   Test 3 free 120-min:   13:00 should appear when its 4 slots are free.
--   Test 4 lunch:          11:00 and 11:30 must NOT appear for volume-perm.
--   Test 5 end of day:     19:00 may appear (ends 21:00); 19:30+ must not.
--   Test 6 legacy #56:     its starting slot must NOT appear.
--
-- select * from public.get_available_starts('2026-09-29', 'mens-haircut');
-- select * from public.get_available_starts('2026-09-29', 'volume-perm');
-- select * from public.get_available_starts('2026-09-29', 'volume-perm')
--   where start_time in ('11:00','11:30','19:00','19:30');
-- select * from public.get_available_starts('2026-09-29', 'down-perm');  -- inactive -> SERVICE_NOT_FOUND
-- =============================================================================
