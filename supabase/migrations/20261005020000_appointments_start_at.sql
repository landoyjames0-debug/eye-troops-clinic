begin;

drop index if exists public.appointments_patient_id_idx;
drop index if exists public.appointments_date_idx;

alter table public.appointments
  add column start_at timestamptz;

update public.appointments
set start_at = (appointment_date + appointment_time) at time zone 'Asia/Manila';

alter table public.appointments
  alter column start_at set not null,
  drop column appointment_date,
  drop column appointment_time,
  rename column appointment_type to type;

create index appointments_patient_id_idx
  on public.appointments (patient_id, start_at desc);
create index appointments_date_idx
  on public.appointments (start_at desc);

grant insert (start_at) on public.appointments to authenticated;
grant update (start_at) on public.appointments to authenticated;

commit;