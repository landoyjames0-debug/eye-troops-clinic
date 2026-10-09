begin;

create or replace function public.delete_appointment(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_appointment_id uuid;
begin
  if auth.uid() is null or not public.current_user_has_clinic_role() then
    raise exception 'An authorized clinic profile is required to delete an appointment.'
      using errcode = '42501';
  end if;

  select id into v_appointment_id
  from public.appointments
  where id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  delete from public.appointments
  where id = v_appointment_id;

  return v_appointment_id;
end;
$$;

revoke all on function public.delete_appointment(uuid) from public, anon;
grant execute on function public.delete_appointment(uuid) to authenticated;

commit;
