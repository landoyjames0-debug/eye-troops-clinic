begin;

do $$
declare
  v_data_type text;
begin
  select data_type into v_data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'appointments'
    and column_name = 'status';

  if v_data_type is null then
    raise exception 'public.appointments.status was not found.';
  end if;

  if v_data_type <> 'USER-DEFINED' then
    alter table public.appointments
      drop constraint if exists appointments_status_check;

    update public.appointments
    set status = case lower(btrim(status::text))
      when 'scheduled' then 'Scheduled'
      when 'confirmed' then 'Scheduled'
      when 'pending' then 'Scheduled'
      when 'arrived' then 'Checked In'
      when 'checked in' then 'Checked In'
      when 'checked_in' then 'Checked In'
      when 'check in' then 'Checked In'
      when 'check_in' then 'Checked In'
      when 'completed' then 'Completed'
      when 'done' then 'Completed'
      when 'no show' then 'No Show'
      when 'no_show' then 'No Show'
      when 'noshow' then 'No Show'
      when 'cancelled' then 'Cancelled'
      when 'canceled' then 'Cancelled'
      else status::text
    end
    where status::text <> case lower(btrim(status::text))
      when 'scheduled' then 'Scheduled'
      when 'confirmed' then 'Scheduled'
      when 'pending' then 'Scheduled'
      when 'arrived' then 'Checked In'
      when 'checked in' then 'Checked In'
      when 'checked_in' then 'Checked In'
      when 'check in' then 'Checked In'
      when 'check_in' then 'Checked In'
      when 'completed' then 'Completed'
      when 'done' then 'Completed'
      when 'no show' then 'No Show'
      when 'no_show' then 'No Show'
      when 'noshow' then 'No Show'
      when 'cancelled' then 'Cancelled'
      when 'canceled' then 'Cancelled'
      else status::text
    end;

    alter table public.appointments
      add constraint appointments_status_check
      check (status in (
        'Scheduled',
        'Confirmed',
        'Checked In',
        'Completed',
        'Cancelled',
        'No Show'
      ));
  end if;
end;
$$;

commit;
