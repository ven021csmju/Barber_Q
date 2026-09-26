-- NEED MIGRATION: review against the live function body before applying.
-- DO NOT apply until the existing customer_name validation and grants have been
-- compared with production. This migration preserves the live row-returning RPC
-- contract; it does not convert create_booking() to jsonb.
--
-- PostgreSQL cannot change a function's return type with CREATE OR REPLACE. This
-- statement therefore only works when the live function already has the exact
-- signature below: RETURNS public.bookings.

create or replace function public.create_booking(
    p_customer_name text,
    p_time_slot_id bigint
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_name       text := btrim(coalesce(p_customer_name, ''));
    v_slot       public.time_slots;
    v_booking    public.bookings;
    v_today      date := (timezone('Asia/Bangkok', now()))::date;
    v_now        time := (timezone('Asia/Bangkok', now()))::time;
begin
    -- Preserve the live validation contract: NULL, empty, and whitespace-only
    -- names are rejected after trimming. Production accepts 121-character names,
    -- so this migration deliberately does not add a length limit.
    if v_name = '' then
        raise exception 'CUSTOMER_NAME_REQUIRED';
    end if;

    select *
      into v_slot
      from public.time_slots
     where id = p_time_slot_id
       for update;

    if not found then
        raise exception 'TIME_SLOT_NOT_FOUND';
    end if;

    if v_slot.status is distinct from 'available' then
        raise exception 'TIME_SLOT_NOT_AVAILABLE';
    end if;

    -- The shop clock is authoritative. A slot is unavailable once it starts.
    if v_slot.slot_date < v_today
       or (v_slot.slot_date = v_today and v_slot.start_time <= v_now) then
        raise exception 'TIME_SLOT_EXPIRED';
    end if;

    if exists (
        select 1
          from public.bookings b
         where b.time_slot_id = p_time_slot_id
           and b.status in ('pending', 'confirmed')
    ) then
        raise exception 'TIME_SLOT_ALREADY_BOOKED';
    end if;

    begin
        insert into public.bookings (customer_name, time_slot_id, status)
        values (v_name, p_time_slot_id, 'pending')
        returning * into v_booking;
    exception
        when unique_violation then
            -- Keep the existing race result and let the unique index remain the
            -- final authority for concurrent callers.
            raise exception 'TIME_SLOT_ALREADY_BOOKED';
    end;

    return v_booking;
end;
$$;

-- Existing grants are intentionally not changed. CREATE OR REPLACE preserves
-- them, and the existing bookings_one_active_per_slot_idx remains untouched.
