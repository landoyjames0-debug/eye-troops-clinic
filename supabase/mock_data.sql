-- Eye TroOps synthetic UI fixtures.
-- Run manually against a LOCAL or dedicated development Supabase project only.
-- Do not run against production. This replaces rows using the reserved DEMO-* /
-- Demo Patient * prefixes; normal app data is not targeted.

begin;

-- Remove only rows created by this fixture so reruns stay repeatable.
do $seed$
begin
  if to_regclass('public.appointments') is not null then
    delete from public.appointments
    where notes like 'DEMO SEED:%';
  end if;
end;
$seed$;

delete from public.orders
where order_number like 'DEMO-%';

delete from public.expenses
where description like 'DEMO SEED:%';

delete from public.patients
where full_name like 'Demo Patient %';

-- 80 patients give roster/search/pagination views enough density without using
-- real names, addresses, phone numbers, or other personal information.
insert into public.patients (full_name, cp_number, address, notes)
select
  format(
    'Demo Patient %s %s %s',
    (array['Alex', 'Jamie', 'Morgan', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Avery', 'Cameron', 'Drew'])[((n - 1) % 10) + 1],
    (array['Santos', 'Reyes', 'Cruz', 'Garcia', 'Flores', 'Ramos', 'Mendoza', 'Aquino'])[((n - 1) % 8) + 1],
    lpad(n::text, 3, '0')
  ),
  format('DEMO-CP-%s', lpad(n::text, 4, '0')),
  format('Mock address %s, Demo City', lpad(n::text, 3, '0')),
  'Synthetic UI fixture. Not a real patient.'
from generate_series(1, 80) as rows(n);

-- 180 visit dates span roughly 900 days so patient drawers and history views
-- contain recent, older, and multi-year examples.
with demo_patients as (
  select id, row_number() over (order by full_name) as patient_no
  from public.patients
  where full_name like 'Demo Patient %'
), visit_rows as (
  select n, ((n - 1) % 80) + 1 as patient_no
  from generate_series(1, 180) as rows(n)
)
insert into public.visits (patient_id, visit_date, notes)
select
  patient.id,
  (current_date - ((visit_rows.n * 13) % 900))::timestamp
    + make_time((visit_rows.n * 7) % 24, (visit_rows.n * 11) % 60, 0),
  format('DEMO SEED: visit %s', lpad(visit_rows.n::text, 3, '0'))
from visit_rows
join demo_patients as patient using (patient_no);

-- Prescriptions exercise the patient drawer and prescription table.
with demo_visits as (
  select
    id,
    row_number() over (order by visit_date, id) as visit_no
  from public.visits
  where notes like 'DEMO SEED: visit %'
)
insert into public.prescriptions (
  visit_id,
  od_sph,
  od_cyl,
  od_axis,
  od_add,
  od_pd,
  os_sph,
  os_cyl,
  os_axis,
  os_add,
  os_pd
)
select
  id,
  case when visit_no % 5 = 0 then 'PLANO' else (((visit_no % 9) * 0.25)::numeric(4, 2))::text end,
  case when visit_no % 3 = 0 then '-0.50' else '0.00' end,
  case when visit_no % 3 = 0 then '180' else '0' end,
  case when visit_no % 4 = 0 then '+1.50' else null end,
  '31',
  case when visit_no % 6 = 0 then 'PLANO' else ((((visit_no + 2) % 9) * 0.25)::numeric(4, 2))::text end,
  case when visit_no % 4 = 0 then '-0.75' else '0.00' end,
  case when visit_no % 4 = 0 then '90' else '0' end,
  case when visit_no % 4 = 0 then '+1.50' else null end,
  '31'
from demo_visits;

-- 160 orders cover each existing status and are linked to the nearest previous
-- synthetic visit for drawer/prescription navigation.
with demo_patients as (
  select id, row_number() over (order by full_name) as patient_no
  from public.patients
  where full_name like 'Demo Patient %'
), order_rows as (
  select
    n,
    ((n - 1) % 80) + 1 as patient_no,
    current_date - ((n * 17) % 900) as order_date,
    (4500 + ((n * 137) % 25500))::numeric(12, 2) as total_amount,
    case n % 10
      when 0 then 'CANCELLED'
      when 1 then 'CLAIMED'
      when 2 then 'READY_FOR_PICKUP'
      when 3 then 'IN_LAB'
      else 'ORDERED'
    end::public.order_status as status
  from generate_series(1, 160) as rows(n)
)
insert into public.orders (order_number, patient_id, visit_id, description, total_amount, status, order_date)
select
  format('DEMO-%s-%s', extract(year from order_rows.order_date)::int, lpad(order_rows.n::text, 5, '0')),
  patient.id,
  visit.id,
  case order_rows.n % 4
    when 0 then 'Single vision lenses · standard frame'
    when 1 then 'Progressive lenses · lightweight frame'
    when 2 then 'Bifocal lenses · classic frame'
    else 'Photochromic lenses · blue-light filter'
  end,
  order_rows.total_amount,
  order_rows.status,
  order_rows.order_date
from order_rows
join demo_patients as patient using (patient_no)
left join lateral (
  select visits.id
  from public.visits as visits
  where visits.patient_id = patient.id
    and visits.notes like 'DEMO SEED: visit %'
    and visits.visit_date::date <= order_rows.order_date
  order by visits.visit_date desc
  limit 1
) as visit on true;

-- Payment distribution: full, partial, unpaid, and multi-part balances.
with demo_orders as (
  select
    id,
    total_amount,
    order_date,
    row_number() over (order by order_number) as order_no
  from public.orders
  where order_number like 'DEMO-%'
)
insert into public.payments (order_id, amount, payment_date, notes, status)
select
  id,
  case order_no % 4
    when 0 then total_amount
    when 1 then round(total_amount * 0.35, 2)
    else round(total_amount * 0.25, 2)
  end,
  order_date + (order_no % 5)::integer,
  case when order_no % 4 = 0 then 'Cash · Full payment' else 'GCash · Deposit' end,
  'COMPLETED'::public.payment_status
from demo_orders
where order_no % 4 <> 2;

with demo_orders as (
  select
    id,
    total_amount,
    order_date,
    row_number() over (order by order_number) as order_no
  from public.orders
  where order_number like 'DEMO-%'
)
insert into public.payments (order_id, amount, payment_date, notes, status)
select
  id,
  round(total_amount * 0.40, 2),
  order_date + ((order_no % 5) + 7)::integer,
  'Maya · Follow-up payment',
  'COMPLETED'::public.payment_status
from demo_orders
where order_no % 4 = 3;

-- Include voided ledger entries to exercise payment history without counting
-- them as sales or paid balance.
with demo_orders as (
  select
    id,
    order_date,
    row_number() over (order by order_number) as order_no
  from public.orders
  where order_number like 'DEMO-%'
)
insert into public.payments (order_id, amount, payment_date, notes, status, voided_at)
select
  id,
  250.00,
  order_date + 1,
  'Cash · Demo voided correction',
  'VOIDED'::public.payment_status,
  now()
from demo_orders
where order_no % 10 = 0;

-- 180 expense rows across common clinic categories and multiple years.
insert into public.expenses (expense_date, category, amount, description)
select
  current_date - ((n * 7) % 900),
  (array['Rent', 'Electricity', 'Water', 'Opto', 'Sales Associate', 'Optician', 'Supplier', 'Other'])[((n - 1) % 8) + 1],
  (250 + ((n * 83) % 45000))::numeric(12, 2),
  format('DEMO SEED: operating expense %s', lpad(n::text, 3, '0'))
from generate_series(1, 180) as rows(n);

-- 120 appointments, including upcoming and past follow-ups, for schedule cards
-- and patient drawer histories. Skip this optional section if the appointments
-- migration has not been applied to the target database yet.
do $seed$
begin
  if to_regclass('public.appointments') is not null then
    with demo_patients as (
      select id, row_number() over (order by full_name) as patient_no
      from public.patients
      where full_name like 'Demo Patient %'
    ), appointment_rows as (
      select n, ((n - 1) % 80) + 1 as patient_no
      from generate_series(1, 120) as rows(n)
    )
    insert into public.appointments (
      patient_id,
      appointment_date,
      appointment_time,
      duration_minutes,
      appointment_type,
      status,
      notes
    )
    select
      patient.id,
      current_date + ((appointment_rows.n % 121) - 60),
      make_time(9 + (appointment_rows.n % 8), (appointment_rows.n % 4) * 15, 0),
      30 + ((appointment_rows.n % 3) * 15),
      case appointment_rows.n % 5
        when 0 then 'Consultation'
        when 1 then 'Follow Up'
        when 2 then 'Eye Exam'
        when 3 then 'Contact Lens Fitting'
        else 'Procedure'
      end::public.appointment_type,
      case appointment_rows.n % 6
        when 0 then 'Scheduled'
        when 1 then 'Confirmed'
        when 2 then 'Checked In'
        when 3 then 'Completed'
        when 4 then 'Cancelled'
        else 'No Show'
      end::public.appointment_status,
      format('DEMO SEED: appointment %s', lpad(appointment_rows.n::text, 3, '0'))
    from appointment_rows
    join demo_patients as patient using (patient_no);
  else
    raise notice 'Appointments skipped: apply the appointments migration to seed those fixtures.';
  end if;
end;
$seed$;

commit;

select
  (select count(*) from public.patients where full_name like 'Demo Patient %') as demo_patients,
  (select count(*) from public.visits where notes like 'DEMO SEED: visit %') as demo_visits,
  (select count(*) from public.orders where order_number like 'DEMO-%') as demo_orders,
  (select count(*) from public.payments where order_id in (select id from public.orders where order_number like 'DEMO-%')) as demo_payments,
  (select count(*) from public.expenses where description like 'DEMO SEED:%') as demo_expenses;

do $seed$
declare
  appointment_count bigint;
begin
  if to_regclass('public.appointments') is not null then
    select count(*) into appointment_count
    from public.appointments
    where notes like 'DEMO SEED:%';
    raise notice 'demo_appointments=%', appointment_count;
  end if;
end;
$seed$;
