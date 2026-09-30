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
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ───────────────────────────────────────────────────
-- Every clinic staff member may read and write application data. There are no
-- sensitive clinical fields beyond what staff already need, and there is no
-- self-service signup, so a single authenticated policy per table is enough.
-- Anonymous users get nothing.
alter table public.users        enable row level security;
alter table public.patients     enable row level security;
alter table public.visits       enable row level security;
alter table public.prescriptions enable row level security;
alter table public.orders       enable row level security;
alter table public.payments     enable row level security;
alter table public.order_status_history enable row level security;
alter table public.expenses     enable row level security;

create policy "staff read users"   on public.users for select to authenticated using (true);
create policy "staff read patients"    on public.patients     for select to authenticated using (true);
create policy "staff read visits"      on public.visits       for select to authenticated using (true);
create policy "staff read prescriptions" on public.prescriptions for select to authenticated using (true);
create policy "staff read orders"      on public.orders       for select to authenticated using (true);
create policy "staff read payments"    on public.payments     for select to authenticated using (true);
create policy "staff read order status history" on public.order_status_history for select to authenticated using (true);
create policy "staff read expenses"    on public.expenses     for select to authenticated using (true);

create policy "staff manage patients"     on public.patients     for all to authenticated using (true) with check (true);
create policy "staff manage visits"       on public.visits       for all to authenticated using (true) with check (true);
create policy "staff manage prescriptions" on public.prescriptions for all to authenticated using (true) with check (true);
create policy "staff manage orders"       on public.orders       for all to authenticated using (true) with check (true);
create policy "staff manage payments"     on public.payments     for all to authenticated using (true) with check (true);
create policy "staff manage order status history" on public.order_status_history for all to authenticated using (true) with check (true);
create policy "staff manage expenses"     on public.expenses     for all to authenticated using (true) with check (true);

-- Staff may correct their own profile, but not other accounts or roles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create policy "staff update own profile" on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
