-- Keep booking Realtime as an invalidation signal only.
-- Existing booking triggers were inspected in production before this migration.
-- This does not change bookings data, RLS, grants, or any booking RPC.

create or replace function public.notify_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_old_slot bigint;
    v_new_slot bigint;
begin
    v_old_slot := case when tg_op = 'INSERT' then null else old.time_slot_id end;
    v_new_slot := case when tg_op = 'DELETE' then null else new.time_slot_id end;

    -- A moved booking invalidates both the old and new slot views.
    if v_old_slot is not null then
        begin
            perform realtime.send(
                jsonb_build_object('time_slot_id', v_old_slot),
                'booking_changed',
                'aphidet:booking-signal',
                false
            );
        exception when others then
            raise warning 'booking realtime signal failed for old slot %: %', v_old_slot, sqlerrm;
        end;
    end if;

    if v_new_slot is not null and v_new_slot is distinct from v_old_slot then
        begin
            perform realtime.send(
                jsonb_build_object('time_slot_id', v_new_slot),
                'booking_changed',
                'aphidet:booking-signal',
                false
            );
        exception when others then
            raise warning 'booking realtime signal failed for new slot %: %', v_new_slot, sqlerrm;
        end;
    end if;

    -- A failed signal must never abort the booking/status mutation.
    return null;
end;
$$;

-- INSERT/DELETE coverage already exists in production. Replace only the
-- narrower UPDATE OF trigger so an update to any booking column invalidates the
-- protected server-side admin reads, without producing duplicate UPDATE events.
drop trigger if exists bookings_realtime_status on public.bookings;

create trigger bookings_realtime_status
after update on public.bookings
for each row
execute function public.notify_booking_change();

comment on function public.notify_booking_change() is
    'Broadcasts booking slot invalidation signals without exposing booking data.';

-- Verification queries (run separately after applying):
-- select tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--  where tgrelid = 'public.bookings'::regclass
--    and not tgisinternal
--  order by tgname;
--
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
--   from pg_proc p
--  where p.oid = 'public.notify_booking_change()'::regprocedure;
