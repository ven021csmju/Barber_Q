-- Add customer phone without changing or dropping the existing booking RPC.
-- Apply only after reviewing the live function definition and grants.

alter table public.bookings
    add column if not exists customer_phone text;

create or replace function public.create_booking(
    p_customer_name text,
    p_customer_phone text,
    p_time_slot_id bigint
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_name       text := btrim(coalesce(p_customer_name, ''));
    v_phone      text := regexp_replace(
        btrim(coalesce(p_customer_phone, '')),
        '[^0-9]',
        '',
        'g'
    );
    v_slot       public.time_slots;
    v_booking    public.bookings;
    v_today      date := (timezone('Asia/Bangkok', now()))::date;
    v_now        time := (timezone('Asia/Bangkok', now()))::time;
begin
    if v_name = '' then
        raise exception 'CUSTOMER_NAME_REQUIRED';
    end if;

    if v_phone = '' then
        raise exception 'CUSTOMER_PHONE_REQUIRED';
    end if;

    if v_phone !~ '^0[689][0-9]{8}$' then
        raise exception 'INVALID_CUSTOMER_PHONE';
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
        insert into public.bookings (
            customer_name,
            customer_phone,
            time_slot_id,
            status
        )
        values (
            v_name,
            v_phone,
            p_time_slot_id,
            'pending'
        )
        returning * into v_booking;
    exception
        when unique_violation then
            raise exception 'TIME_SLOT_ALREADY_BOOKED';
    end;

    return v_booking;
end;
$$;

revoke all on function public.create_booking(text, text, bigint) from public;
grant execute on function public.create_booking(text, text, bigint) to anon, authenticated;

-- Verification queries (run separately after applying):
-- select column_name, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'bookings'
--    and column_name = 'customer_phone';
--
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname = 'create_booking';
--
-- select has_function_privilege('anon', 'public.create_booking(text,text,bigint)', 'execute'),
--        has_function_privilege('authenticated', 'public.create_booking(text,text,bigint)', 'execute');
--
-- select relrowsecurity
--   from pg_class
--  where oid = 'public.bookings'::regclass;
