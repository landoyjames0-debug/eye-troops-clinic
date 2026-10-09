create table public.followups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  order_id uuid unique references public.orders (id) on delete cascade,
  appointment_id uuid unique references public.appointments (id) on delete cascade,
  reason text not null check (reason in ('review', 'checkup', 'pickup', 'balance', 'other')),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'done', 'snoozed')),
  snoozed_until date,
  notes text,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index followups_due_date_idx on public.followups (due_date);
create index followups_status_idx on public.followups (status);
create index followups_patient_id_idx on public.followups (patient_id, due_date);

alter table public.followups enable row level security;
revoke all on public.followups from public, anon;
grant select, insert, update on public.followups to authenticated;

create policy "authenticated staff read followups" on public.followups
  for select to authenticated using (true);
create policy "authenticated staff insert followups" on public.followups
  for insert to authenticated with check (true);
create policy "authenticated staff update followups" on public.followups
  for update to authenticated using (true) with check (true);

create or replace view public.followup_queue
with (security_invoker = true)
as
  select
    f.id,
    f.patient_id,
    f.order_id,
    f.appointment_id,
    f.reason,
    case
      when f.status = 'snoozed' and f.snoozed_until >= (now() at time zone 'Asia/Manila')::date
        then f.snoozed_until
      else f.due_date
    end as due_date,
    case when f.status = 'snoozed' then 'open' else f.status end as status,
    f.snoozed_until,
    f.notes,
    f.created_by,
    f.created_at,
    f.completed_at,
    p.full_name as patient_name,
    p.cp_number as patient_phone,
    false as is_auto
  from public.followups f
  join public.patients p on p.id = f.patient_id
  where f.status = 'open'
     or (f.status = 'snoozed' and f.snoozed_until >= (now() at time zone 'Asia/Manila')::date)

  union all

  select
    md5('appointment:' || a.id::text)::uuid as id,
    a.patient_id,
    null::uuid as order_id,
    a.id as appointment_id,
    'review'::text as reason,
    (a.start_at at time zone 'Asia/Manila')::date as due_date,
    'open'::text as status,
    null::date as snoozed_until,
    a.notes,
    a.created_by,
    a.created_at,
    null::timestamptz as completed_at,
    p.full_name as patient_name,
    p.cp_number as patient_phone,
    true as is_auto
  from public.appointments a
  join public.patients p on p.id = a.patient_id
  where a.type = 'Follow Up'
    and a.status not in ('Completed', 'Cancelled', 'No Show')
    and (a.start_at at time zone 'Asia/Manila')::date between
      (now() at time zone 'Asia/Manila')::date and
      (now() at time zone 'Asia/Manila')::date + 7
    and not exists (
      select 1 from public.followups f
      where f.appointment_id = a.id
        and (f.status = 'done' or (f.status = 'snoozed' and f.snoozed_until >= (now() at time zone 'Asia/Manila')::date))
    )

  union all

  select
    md5('order:' || o.id::text)::uuid as id,
    o.patient_id,
    o.id as order_id,
    null::uuid as appointment_id,
    'pickup'::text as reason,
    ready.ready_date as due_date,
    'open'::text as status,
    null::date as snoozed_until,
    o.description as notes,
    o.created_by,
    o.created_at,
    null::timestamptz as completed_at,
    p.full_name as patient_name,
    p.cp_number as patient_phone,
    true as is_auto
  from public.orders o
  join public.patients p on p.id = o.patient_id
  left join lateral (
    select (h.changed_at at time zone 'Asia/Manila')::date as ready_date
    from public.order_status_history h
    where h.order_id = o.id and h.status = 'READY_FOR_PICKUP'
    order by h.changed_at desc
    limit 1
  ) ready_history on true
  cross join lateral (
    select coalesce(ready_history.ready_date, (o.updated_at at time zone 'Asia/Manila')::date) as ready_date
  ) ready
  where o.status = 'READY_FOR_PICKUP'
    and ready.ready_date <= (now() at time zone 'Asia/Manila')::date - 7
    and not exists (
      select 1 from public.followups f
      where f.order_id = o.id
        and (f.status = 'done' or (f.status = 'snoozed' and f.snoozed_until >= (now() at time zone 'Asia/Manila')::date))
    )

  union all

  select
    md5('patient-review:' || p.id::text)::uuid as id,
    p.id as patient_id,
    null::uuid as order_id,
    null::uuid as appointment_id,
    'review'::text as reason,
    (visits.last_visit + interval '12 months')::date as due_date,
    'open'::text as status,
    null::date as snoozed_until,
    p.notes,
    p.created_by,
    p.created_at,
    null::timestamptz as completed_at,
    p.full_name as patient_name,
    p.cp_number as patient_phone,
    true as is_auto
  from public.patients p
  join lateral (
    select max((v.visit_date at time zone 'Asia/Manila')::date) as last_visit
    from public.visits v
    where v.patient_id = p.id
  ) visits on visits.last_visit is not null
  where p.archived_at is null
    and visits.last_visit <= (now() at time zone 'Asia/Manila')::date - interval '12 months'
    and not exists (
      select 1 from public.followups f
      where f.patient_id = p.id
        and f.reason = 'review'
        and f.due_date = (visits.last_visit + interval '12 months')::date
        and (f.status = 'done' or (f.status = 'snoozed' and f.snoozed_until >= (now() at time zone 'Asia/Manila')::date))
    );

revoke all on public.followup_queue from public, anon;
grant select on public.followup_queue to authenticated;