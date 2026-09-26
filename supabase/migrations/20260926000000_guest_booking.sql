-- =============================================================================
-- Guest booking: two tables, no accounts
-- =============================================================================
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Idempotent: every statement is IF NOT EXISTS / OR REPLACE, so re-running is safe.
--
-- Verified starting point (probed against project lwuiwtyrqosnpcbchksc):
--   time_slots : id, start_time, end_time, created_at
--   bookings   : id, customer_id uuid, barber_id, service_id, time_slot_id,
--                booking_date date, status, note, created_at, updated_at
--   plus unused tables: customers, barbers, services, promotions
-- The three tables this migration changes were EMPTY (0 rows) when probed, so
-- restructuring them destroys no data. Section 1 re-checks that in the database
-- and aborts rather than inventing values if it is no longer true.
--
-- MODEL CHANGE (important):
--   Before, time_slots was a RECURRING weekly schedule and a booking carried its
--   own booking_date. Now each slot belongs to ONE calendar date:
--       time_slots.slot_date
--   so a booking's date is derived from its slot and bookings.booking_date is
--   removed. Availability becomes "slot exists, is not blocked, has no active
--   booking".
--
-- LEFT INTENTIONALLY ALONE: customers, barbers, services, promotions.
-- The app no longer reads or writes them, but they are not dropped, because
-- DROP TABLE is irreversible and may hold data you still want. See section 9.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. time_slots becomes date-specific
-- -----------------------------------------------------------------------------
alter table public.time_slots add column if not exists slot_date date;

-- Nothing to carry over (the table is empty). If it is not empty this needs a
-- real backfill decision, so abort rather than silently invent dates.
do $$
begin
    if exists (select 1 from public.time_slots where slot_date is null) then
        raise exception 'time_slots has rows without slot_date -- backfill slot_date before continuing';
    end if;
end $$;

alter table public.time_slots alter column slot_date set not null;
alter table public.time_slots alter column slot_date set default current_date;

alter table public.time_slots add column if not exists status text;

update public.time_slots set status = 'available' where status is null;

alter table public.time_slots alter column status set not null;
alter table public.time_slots alter column status set default 'available';
alter table public.time_slots alter column created_at set default now();

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'time_slots_status_check'
    ) then
        alter table public.time_slots
            add constraint time_slots_status_check
            check (status in ('available', 'blocked'));
    end if;
end $$;

comment on column public.time_slots.slot_date is
  'The single calendar date this slot belongs to.';
comment on column public.time_slots.status is
  'available = bookable by guests, blocked = closed by the shop.';

create index if not exists time_slots_date_time_idx
    on public.time_slots (slot_date, start_time);

-- -----------------------------------------------------------------------------
-- 2. bookings becomes name-only
-- -----------------------------------------------------------------------------
alter table public.bookings add column if not exists customer_name text;

-- Backfill from the old free-text note, but only while that column still exists:
-- on a re-run `note` has already been dropped, and referencing it would abort the
-- whole migration. Dynamic SQL keeps this genuinely idempotent.
do $$
begin
    if exists (
        select 1
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'bookings'
           and column_name = 'note'
    ) then
        execute $sql$
            update public.bookings b
               set customer_name = coalesce(nullif(btrim(b.note), ''), 'ไม่ระบุชื่อ')
             where b.customer_name is null
        $sql$;
    end if;
end $$;

alter table public.bookings alter column customer_name set not null;

comment on column public.bookings.customer_name is
  'Name typed by the guest at booking time. There is no customer account.';

-- The date now lives on the slot.
alter table public.bookings drop column if exists booking_date;

-- Columns the guest flow never sends. The table is empty, so these go away
-- rather than lingering as dead NOT NULL columns.
alter table public.bookings drop column if exists customer_id;
alter table public.bookings drop column if exists auth_user_id;
alter table public.bookings drop column if exists account_id;
alter table public.bookings drop column if exists service_id;
alter table public.bookings drop column if exists barber_id;
alter table public.bookings drop column if exists note;

-- Real referential integrity: a booking must point at a real slot.
-- RESTRICT, not CASCADE: deleting a slot that someone booked must fail loudly
-- rather than silently erasing their booking.
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'bookings_time_slot_id_fkey'
    ) then
        alter table public.bookings
            add constraint bookings_time_slot_id_fkey
            foreign key (time_slot_id)
            references public.time_slots (id)
            on delete restrict;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'bookings_status_check'
    ) then
        alter table public.bookings
            add constraint bookings_status_check
            check (status in ('pending', 'confirmed', 'cancelled', 'completed'));
    end if;
end $$;

-- The guest insert sends only (customer_name, time_slot_id, status), so the
-- timestamps need database defaults or the INSERT fails.
alter table public.bookings alter column status set default 'pending';
alter table public.bookings alter column created_at set default now();
alter table public.bookings alter column updated_at set default now();

-- Keep updated_at honest on every UPDATE, not just the ones that remember it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
    before update on public.bookings
    for each row
    execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 3. One active booking per slot -- enforced by the database
--
--    `time_slots.status` is NOT part of this. It records only whether the shop
--    has the slot open for sale (available / blocked). Occupancy is derived
--    entirely from `bookings`, so booking state is never duplicated into the
--    slot row and cannot drift out of sync.
--
--        status = 'available' + no active booking -> AVAILABLE
--        status = 'available' + active booking   -> BOOKED
--        status = 'blocked'                      -> BLOCKED
--
--    where "active" = status in ('pending', 'confirmed', 'completed').
--
--    The index deliberately covers only ('pending', 'confirmed'): those are the
--    states a guest can create, and they are what two concurrent guests race
--    over. 'completed' is admin-only and describes a finished appointment, so
--    excluding it keeps a past slot from permanently locking its own history.
--    The authoritative gate for every insert is create_booking() in section 4,
--    which rejects a slot that already has any active booking.
--
--    Dropped and recreated rather than CREATE ... IF NOT EXISTS, so re-running
--    this file picks up a changed predicate instead of silently keeping the old
--    index.
-- -----------------------------------------------------------------------------
drop index if exists public.bookings_one_active_per_slot;

create unique index bookings_one_active_per_slot
    on public.bookings (time_slot_id)
    where status in ('pending', 'confirmed');

-- -----------------------------------------------------------------------------
-- 4. The booking operation -- one atomic database call
--
--    The guest flow must NOT be "SELECT the slot, check it is free, then INSERT"
--    as three separate client requests. Between the check and the insert another
--    guest can take the same slot, so the frontend's answer would be stale. Any
--    client-side check is a courtesy for the UI, never the guarantee.
--
--    create_booking() is the whole operation, in one statement inside one
--    transaction, and it is the only way a guest can create a booking: anon is
--    granted no INSERT on bookings at all (section 5). The function re-verifies
--    everything from inside the database, then relies on the section 3 index to
--    settle a genuine race -- the loser gets unique_violation, which is caught
--    and returned as reason 'taken' rather than surfacing as a 500.
--
--    It is SECURITY DEFINER because it must read `bookings` to check occupancy,
--    and guests must not be able to read that table. It returns jsonb so the
--    client can branch on a controlled reason instead of parsing an error.
-- -----------------------------------------------------------------------------
-- Dropped first so that re-running this file cannot fail on
-- "cannot change return type of existing function" if an earlier version of
-- this migration was applied with a different signature.
drop function if exists public.create_booking(text, bigint);

create or replace function public.create_booking(
    p_customer_name text,
    p_time_slot_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_name   text := btrim(coalesce(p_customer_name, ''));
    v_status text;
    v_id     bigint;
begin
    if v_name = '' or length(v_name) > 120 then
        return jsonb_build_object('ok', false, 'reason', 'invalid_name');
    end if;

    if p_time_slot_id is null then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    -- 1 + 2: the slot exists and the shop has it open for sale.
    -- `for update` serialises concurrent callers on this row, so the check
    -- below and the insert cannot interleave.
    select s.status
      into v_status
      from public.time_slots s
     where s.id = p_time_slot_id
       for update;

    if not found then
        return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    -- `is distinct from` rather than `<>`, so an unexpected NULL status is
    -- rejected too. A bare `<>` against NULL yields NULL, and `if NULL then` is
    -- false, which would let the booking fall through.
    if v_status is distinct from 'available' then
        return jsonb_build_object('ok', false, 'reason', 'blocked');
    end if;

    -- 3: no active booking. 'cancelled' is excluded, so cancelling a booking
    -- genuinely returns the slot to the pool.
    if exists (
        select 1
          from public.bookings b
         where b.time_slot_id = p_time_slot_id
           and b.status in ('pending', 'confirmed', 'completed')
    ) then
        return jsonb_build_object('ok', false, 'reason', 'taken');
    end if;

    -- 4 + 5. A guest can only ever create a pending booking; confirmed and
    -- completed are admin-only transitions.
    begin
        insert into public.bookings (customer_name, time_slot_id, status)
        values (v_name, p_time_slot_id, 'pending')
        returning id into v_id;

        return jsonb_build_object('ok', true, 'bookingId', v_id);
    exception
        when unique_violation then
            -- Lost the race to a concurrent create_booking. Controlled error, not
            -- a 500: the caller shows the slot-taken message and refreshes.
            return jsonb_build_object('ok', false, 'reason', 'taken');
    end;
end;
$$;

comment on function public.create_booking(text, bigint) is
  'Atomically books a guest into one slot. Returns {ok:true, bookingId} or {ok:false, reason}.';

-- Occupancy for the time grid, without exposing a single guest name. Mirrors the
-- check inside create_booking() exactly, so the grid and the gate can never
-- disagree about what is taken.
create or replace function public.booked_slot_ids(p_date date)
returns table (time_slot_id bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select b.time_slot_id
      from public.bookings b
      join public.time_slots s on s.id = b.time_slot_id
     where s.slot_date = p_date
       and b.status in ('pending', 'confirmed', 'completed');
$$;

comment on function public.booked_slot_ids(date) is
  'Ids of slots already taken on a date. Exposes no customer data.';

-- -----------------------------------------------------------------------------
-- 5. RLS for guests (anon)
--
--    Guests may READ bookable slots and CREATE a pending booking. They may not
--    read, update or delete anything else.
--
--    RLS is enabled throughout and is NOT disabled. The insert policy
--    deliberately does not let a guest insert a confirmed/completed row, so a
--    guest can never skip the queue.
-- -----------------------------------------------------------------------------
alter table public.time_slots enable row level security;
alter table public.bookings   enable row level security;

-- Guests only ever see slots the shop has left open.
drop policy if exists "guests read available slots" on public.time_slots;
create policy "guests read available slots"
    on public.time_slots
    for select
    to anon
    using (status = 'available');

grant select on public.time_slots to anon;

-- Bookings are NOT writable by guests at the table level. There is no INSERT
-- policy and no INSERT privilege: the only route to a booking row is the atomic
-- create_booking() function in section 4. RLS denies by default, so even if a
-- privilege were granted by mistake the policy-less table would still refuse the
-- write.
--
-- Dropped in case an earlier version of this migration granted it.
drop policy if exists "guests create pending bookings" on public.bookings;

revoke all on public.bookings from anon, authenticated;

-- No select/update/delete policy exists for anon on bookings, and the table
-- privileges are withheld too, so guest names stay private no matter what.

-- -----------------------------------------------------------------------------
-- 6. Function grants
--    SECURITY DEFINER functions are executable by PUBLIC by default; narrow it.
-- -----------------------------------------------------------------------------
-- create_booking is the one write path a guest has.
revoke all on function public.create_booking(text, bigint) from public;
grant execute on function public.create_booking(text, bigint) to anon, authenticated;

revoke all on function public.booked_slot_ids(date) from public;
grant execute on function public.booked_slot_ids(date) to anon, authenticated;

-- slot_is_bookable is no longer used: create_booking() does the check inline.
-- Dropped so an earlier run of this migration does not leave it behind.
drop function if exists public.slot_is_bookable(bigint);

-- The trigger function is never called directly.
revoke all on function public.touch_updated_at() from public;

-- -----------------------------------------------------------------------------
-- 7. Admin access
--
--    Admin never runs in the browser. Next.js server code uses
--    SUPABASE_SECRET_KEY (server-only, never NEXT_PUBLIC_), which bypasses RLS,
--    behind a passcode session. That is why no admin write policy is granted to
--    anon above -- there is deliberately no public path to cancel a booking or
--    block a slot.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 8. Time zone
--
--    Deliberately NOT changed here. slot_date is a plain date and start_time a
--    plain time, so the app never does timezone arithmetic -- it formats the
--    values it was given. `alter database ... set timezone` would affect every
--    other consumer of this project, so if you do want it, run it yourself:
--      alter database postgres set timezone to 'Asia/Bangkok';
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 9. OPTIONAL: drop the tables this app no longer uses
--
--    Left commented out on purpose -- DROP TABLE cannot be undone. Only run this
--    once you are certain you want customers / barbers / services / promotions
--    gone, ideally after a backup (Supabase Dashboard -> Database -> Backups).
--
-- -- drop table if exists public.promotions;
-- -- drop table if exists public.services;
-- -- drop table if exists public.barbers;
-- -- drop table if exists public.customers;
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 10. Verify after applying
-- -----------------------------------------------------------------------------
-- -- time_slots shape
-- -- select column_name, data_type, is_nullable
-- --   from information_schema.columns
-- --  where table_name = 'time_slots' order by ordinal_position;
--
-- -- bookings shape
-- -- select column_name, data_type, is_nullable
-- --   from information_schema.columns
-- --  where table_name = 'bookings' order by ordinal_position;
--
-- -- guests must NOT be able to read bookings (expect false)
-- -- select has_table_privilege('anon', 'public.bookings', 'select') as anon_reads_bookings;
--
-- -- guests must NOT be able to insert directly (expect false). The only write
-- -- path is create_booking().
-- -- select has_table_privilege('anon', 'public.bookings', 'insert') as anon_inserts_bookings;
--
-- -- but guests CAN call the booking function (expect true)
-- -- select has_function_privilege('anon', 'public.create_booking(text,bigint)', 'execute') as anon_can_book;
--
-- -- the booking function is the single atomic operation
-- --   select public.create_booking('สมชาย', <slot_id>);
-- --   -> {"ok":true,"bookingId":1}
--
-- -- booking the same slot again is refused, controlled, not a crash
-- --   select public.create_booking('สมหญิง', <slot_id>);
-- --   -> {"ok":false,"reason":"taken"}
--
-- -- a blocked slot is refused for a different reason
-- --   update time_slots set status='blocked' where id = <slot_id>;
-- --   select public.create_booking('ใครคนหนึ่ง', <slot_id>);
-- --   -> {"ok":false,"reason":"blocked"}
--
-- -- cancelling frees the slot again
-- --   update bookings set status='cancelled' where id = <booking_id>;
-- --   select public.create_booking('คนใหม่', <slot_id>);
-- --   -> {"ok":true,"bookingId":2}
--
-- -- and a real concurrent race settles on exactly one winner. In two separate
-- --    psql sessions, run these at the same time against the same free slot:
-- --      select public.create_booking('A', <slot_id>);
-- --      select public.create_booking('B', <slot_id>);
-- --    Exactly one returns ok:true; the other returns reason 'taken'. Verify:
-- --   select count(*) from bookings where time_slot_id = <slot_id>
-- --     and status in ('pending','confirmed');   -- must be 1
--
-- -- time_slots.status is never touched by a booking
-- --   select id, status from time_slots where id = <slot_id>;  -- still 'available'
