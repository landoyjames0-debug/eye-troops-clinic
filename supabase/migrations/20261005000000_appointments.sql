create type public.appointment_status as enum (
  'Scheduled',
  'Confirmed',
  'Checked In',
  'Completed',
  'Cancelled',
  'No Show'
);

create type public.appointment_type as enum (
  'Consultation',
  'Follow Up',
  'Eye Exam',
  'Contact Lens Fitting',
  'Procedure'
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  appointment_type public.appointment_type not null default 'Consultation',
  status public.appointment_status not null default 'Scheduled',
  notes text,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_patient_id_idx on public.appointments (patient_id, appointment_date desc, appointment_time desc);
create index appointments_date_idx on public.appointments (appointment_date desc, appointment_time desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger appointments_touch_updated_at
  before update on public.appointments
  for each row execute function public.touch_updated_at();

alter table public.appointments enable row level security;

create policy "staff read appointments" on public.appointments
  for select to authenticated using (true);

create policy "staff insert appointments" on public.appointments
  for insert to authenticated with check (true);

create policy "staff update appointments" on public.appointments
  for update to authenticated using (true) with check (true);

revoke insert, update, delete on public.appointments from anon, authenticated;

grant select on public.appointments to authenticated;
grant insert (
  patient_id,
  appointment_date,
  appointment_time,
  duration_minutes,
  appointment_type,
  status,
  notes
) on public.appointments to authenticated;
grant update (
  patient_id,
  appointment_date,
  appointment_time,
  duration_minutes,
  appointment_type,
  status,
  notes
) on public.appointments to authenticated;
