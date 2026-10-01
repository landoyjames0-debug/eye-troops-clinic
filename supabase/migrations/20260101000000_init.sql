-- Eye TroOps Optical Clinic — initial schema
-- Money is stored as numeric(12,2) in PHP pesos.
-- Sales are never stored: they are always SUM(payments.amount) by payment_date,
-- counting only COMPLETED payments (voided or refunded rows are excluded).

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────
create type public.user_role as enum ('admin', 'staff');
create type public.order_status as enum ('ORDERED', 'IN_LAB', 'READY_FOR_PICKUP', 'CLAIMED', 'CANCELLED');
-- Payments are append-only; a correction is recorded as a VOIDED row rather than
-- a destructive delete, so the financial history stays intact.
create type public.payment_status as enum ('COMPLETED', 'VOIDED', 'REFUNDED');

-- ── users ────────────────────────────────────────────────────────────────
-- Mirrors auth.users. full_name and role are editable in the dashboard;
-- every other field on auth.users is off limits to this app.
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  full_name  text not null,
  role       public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

comment on table public.users is 'Clinic staff profile, one row per auth user.';

-- ── patients ─────────────────────────────────────────────────────────────
create table public.patients (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null check (length(btrim(full_name)) > 0),
  cp_number  text,
  address    text,
  notes      text,
  archived_at timestamptz,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_full_name_idx on public.patients (lower(full_name));
create index patients_cp_number_idx on public.patients (cp_number);

-- ── visits ───────────────────────────────────────────────────────────────
create table public.visits (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  visit_date timestamptz not null default now(),
  notes      text,
  created_by uuid default auth.uid() references public.users (id) on delete set null,
  updated_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index visits_patient_id_idx on public.visits (patient_id, visit_date desc);
create index visits_visit_date_idx on public.visits (visit_date desc);

-- ── prescriptions ────────────────────────────────────────────────────────
-- One prescription per visit. OD/OS lenses, dioptres stored as text so
-- "+1.00", "-0.50" and "PLANO" can all be recorded exactly as written.
create table public.prescriptions (
  id      uuid primary key default gen_random_uuid(),
  visit_id uuid not null unique references public.visits (id) on delete cascade,
  od_sph  text,
  od_cyl  text,
  od_axis text,
  od_add  text,
  od_pd   text,
  os_sph  text,
  os_cyl  text,
  os_axis text,
  os_add  text,
  os_pd   text,
  created_at timestamptz not null default now()
);

create index prescriptions_visit_id_idx on public.prescriptions (visit_id);

-- ── orders ───────────────────────────────────────────────────────────────
-- No `paid` or `balance` column on purpose: both are derived from payments so
-- they can never drift out of sync.
create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  patient_id   uuid not null references public.patients (id) on delete restrict,
  visit_id     uuid references public.visits (id) on delete set null,
  description  text,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  status       public.order_status not null default 'ORDERED',
  order_date   date not null default current_date,
  created_by   uuid default auth.uid() references public.users (id) on delete set null,
  updated_by   uuid default auth.uid() references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index orders_patient_id_idx on public.orders (patient_id);
create index orders_status_idx on public.orders (status);
create index orders_order_date_idx on public.orders (order_date desc);

-- ── payments ─────────────────────────────────────────────────────────────
-- Append-only. An order is paid when SUM(amount) of its COMPLETED payments
-- reaches total_amount. The balance is total_amount - SUM(paid), clamped at
-- zero. A mistaken payment is corrected with a VOIDED/REFUNDED status change,
-- never a row delete, so the financial history is preserved.
create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  amount        numeric(12, 2) not null check (amount > 0),
  payment_date  date not null default current_date,
  notes         text,
  status        public.payment_status not null default 'COMPLETED',
  voided_at     timestamptz,
  created_by    uuid default auth.uid() references public.users (id) on delete set null,
  updated_by    uuid default auth.uid() references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_payment_date_idx on public.payments (payment_date desc);
create index payments_status_idx on public.payments (status);

-- ── order_status_history ─────────────────────────────────────────────────
-- Append-only trail so the order drawer can answer "when was this order
-- created, sent to the lab, ready, claimed?" Payloads are never edited.
create table public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid() references public.users (id) on delete set null
);

create index order_status_history_order_id_idx on public.order_status_history (order_id, changed_at);

-- ── expenses ─────────────────────────────────────────────────────────────
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category     text not null check (length(btrim(category)) > 0),
  amount       numeric(12, 2) not null check (amount > 0),
  description  text,
  created_by   uuid default auth.uid() references public.users (id) on delete set null,
  updated_by   uuid default auth.uid() references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index expenses_expense_date_idx on public.expenses (expense_date desc);
create index expenses_category_idx on public.expenses (category);

-- ── keep updated_at / updated_by current ─────────────────────────────────
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

create trigger patients_touch_updated_at
  before update on public.patients
  for each row execute function public.touch_updated_at();

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

create trigger visits_touch_updated_at
  before update on public.visits
  for each row execute function public.touch_updated_at();

create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function public.touch_updated_at();

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

-- ── record every order status change ──────────────────────────────────────
-- The trail is written by the database rather than the client, so it is complete
-- no matter which path created or changed the order — including `supabase db
-- reset`, which runs the seed through the same triggers.
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_change();

-- ── auto-create a staff profile when a user signs up ─────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Clinic staff'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Also create staff rows for Auth users who existed before this migration.
insert into public.users (id, email, full_name)
select
  id,
  email,
  coalesce(
    nullif(btrim(raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Clinic staff'
  )
from auth.users
where email is not null
on conflict (id) do nothing;

-- ── Row Level Security ───────────────────────────────────────────────────
-- Authenticated staff can read shared clinic records. Writes are limited to
-- the operations used by the app; anonymous users receive no table access.
alter table public.users        enable row level security;
alter table public.patients     enable row level security;
alter table public.visits       enable row level security;
alter table public.prescriptions enable row level security;
alter table public.orders       enable row level security;
alter table public.payments     enable row level security;
alter table public.order_status_history enable row level security;
alter table public.expenses     enable row level security;

create policy "staff read own user profile" on public.users
  for select to authenticated using (id = auth.uid());
create policy "staff read patients"    on public.patients     for select to authenticated using (true);
create policy "staff read visits"      on public.visits       for select to authenticated using (true);
create policy "staff read prescriptions" on public.prescriptions for select to authenticated using (true);
create policy "staff read orders"      on public.orders       for select to authenticated using (true);
create policy "staff read payments"    on public.payments     for select to authenticated using (true);
create policy "staff read order status history" on public.order_status_history for select to authenticated using (true);
create policy "staff read expenses"    on public.expenses     for select to authenticated using (true);

-- Revoke broad default table writes before granting app-specific operations.
revoke insert, update, delete on
  public.users,
  public.patients,
  public.visits,
  public.prescriptions,
  public.orders,
  public.payments,
  public.order_status_history,
  public.expenses
from anon, authenticated;

grant select on
  public.users,
  public.patients,
  public.visits,
  public.prescriptions,
  public.orders,
  public.payments,
  public.order_status_history,
  public.expenses
to authenticated;

-- A staff member can update only their own name, never their role or email.
grant update (full_name) on public.users to authenticated;
create policy "staff update own profile" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant insert (full_name, cp_number, address, notes) on public.patients to authenticated;
grant update (full_name, cp_number, address, notes, archived_at) on public.patients to authenticated;
create policy "staff insert patients" on public.patients
  for insert to authenticated with check (true);
create policy "staff update patients" on public.patients
  for update to authenticated using (true) with check (true);

grant insert (patient_id, visit_date, notes) on public.visits to authenticated;
grant delete on public.visits to authenticated;
create policy "staff insert visits" on public.visits
  for insert to authenticated with check (true);
-- Visit creation rolls back its own visit if prescription insertion fails.
create policy "staff rollback own visits" on public.visits
  for delete to authenticated using (created_by = auth.uid());

grant insert (
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
) on public.prescriptions to authenticated;
create policy "staff insert prescriptions" on public.prescriptions
  for insert to authenticated with check (true);

grant insert (order_number, patient_id, visit_id, description, total_amount, status, order_date)
  on public.orders to authenticated;
grant update (description, total_amount, status) on public.orders to authenticated;
create policy "staff insert orders" on public.orders
  for insert to authenticated with check (true);
create policy "staff update orders" on public.orders
  for update to authenticated using (true) with check (true);

grant insert (order_id, amount, payment_date, notes) on public.payments to authenticated;
grant update (status, voided_at) on public.payments to authenticated;
create policy "staff insert payments" on public.payments
  for insert to authenticated with check (true);
create policy "staff void completed payments" on public.payments
  for update to authenticated
  using (status = 'COMPLETED')
  with check (status = 'VOIDED' and voided_at is not null);

grant insert (expense_date, category, amount, description) on public.expenses to authenticated;
grant update (expense_date, category, amount, description) on public.expenses to authenticated;
grant delete on public.expenses to authenticated;
create policy "staff insert expenses" on public.expenses
  for insert to authenticated with check (true);
create policy "staff update expenses" on public.expenses
  for update to authenticated using (true) with check (true);
create policy "staff delete expenses" on public.expenses
  for delete to authenticated using (true);
