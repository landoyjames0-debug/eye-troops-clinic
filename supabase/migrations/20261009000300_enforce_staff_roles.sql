create or replace function public.current_user_has_clinic_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role in ('admin', 'staff')
  );
$$;

revoke all on function public.current_user_has_clinic_role() from public, anon;
grant execute on function public.current_user_has_clinic_role() to authenticated;

create or replace function public.enforce_clinic_role_on_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.current_user_has_clinic_role() then
    raise exception 'A clinic staff profile is required for this operation.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists patients_require_clinic_role on public.patients;
create trigger patients_require_clinic_role
  before insert or update or delete on public.patients
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists visits_require_clinic_role on public.visits;
create trigger visits_require_clinic_role
  before insert or update or delete on public.visits
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists prescriptions_require_clinic_role on public.prescriptions;
create trigger prescriptions_require_clinic_role
  before insert or update or delete on public.prescriptions
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists orders_require_clinic_role on public.orders;
create trigger orders_require_clinic_role
  before insert or update or delete on public.orders
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists payments_require_clinic_role on public.payments;
create trigger payments_require_clinic_role
  before insert or update or delete on public.payments
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists order_status_history_require_clinic_role on public.order_status_history;
create trigger order_status_history_require_clinic_role
  before insert or update or delete on public.order_status_history
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists expenses_require_clinic_role on public.expenses;
create trigger expenses_require_clinic_role
  before insert or update or delete on public.expenses
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists appointments_require_clinic_role on public.appointments;
create trigger appointments_require_clinic_role
  before insert or update or delete on public.appointments
  for each row execute function public.enforce_clinic_role_on_write();
drop trigger if exists followups_require_clinic_role on public.followups;
create trigger followups_require_clinic_role
  before insert or update or delete on public.followups
  for each row execute function public.enforce_clinic_role_on_write();

alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.prescriptions enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.expenses enable row level security;
alter table public.appointments enable row level security;
alter table public.followups enable row level security;

drop policy if exists "staff update own profile" on public.users;
create policy "staff update own profile" on public.users
  for update to authenticated
  using (id = auth.uid() and public.current_user_has_clinic_role())
  with check (id = auth.uid() and public.current_user_has_clinic_role());

drop policy if exists "staff read patients" on public.patients;
create policy "staff read patients" on public.patients
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert patients" on public.patients;
create policy "staff insert patients" on public.patients
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "staff update patients" on public.patients;
create policy "staff update patients" on public.patients
  for update to authenticated
  using (public.current_user_has_clinic_role())
  with check (public.current_user_has_clinic_role());

drop policy if exists "staff read visits" on public.visits;
create policy "staff read visits" on public.visits
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert visits" on public.visits;
create policy "staff insert visits" on public.visits
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "staff rollback own visits" on public.visits;
create policy "staff rollback own visits" on public.visits
  for delete to authenticated
  using (created_by = auth.uid() and public.current_user_has_clinic_role());

drop policy if exists "staff read prescriptions" on public.prescriptions;
create policy "staff read prescriptions" on public.prescriptions
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert prescriptions" on public.prescriptions;
create policy "staff insert prescriptions" on public.prescriptions
  for insert to authenticated with check (public.current_user_has_clinic_role());

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert orders" on public.orders;
create policy "staff insert orders" on public.orders
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
  for update to authenticated
  using (public.current_user_has_clinic_role())
  with check (public.current_user_has_clinic_role());

drop policy if exists "staff read payments" on public.payments;
create policy "staff read payments" on public.payments
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert payments" on public.payments;
create policy "staff insert payments" on public.payments
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "staff void completed payments" on public.payments;
create policy "staff void completed payments" on public.payments
  for update to authenticated
  using (status = 'COMPLETED' and public.current_user_has_clinic_role())
  with check (status = 'VOIDED' and voided_at is not null and public.current_user_has_clinic_role());

drop policy if exists "staff read order status history" on public.order_status_history;
create policy "staff read order status history" on public.order_status_history
  for select to authenticated using (public.current_user_has_clinic_role());

drop policy if exists "staff read expenses" on public.expenses;
create policy "staff read expenses" on public.expenses
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert expenses" on public.expenses;
create policy "staff insert expenses" on public.expenses
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "staff update expenses" on public.expenses;
create policy "staff update expenses" on public.expenses
  for update to authenticated
  using (public.current_user_has_clinic_role())
  with check (public.current_user_has_clinic_role());
drop policy if exists "staff delete expenses" on public.expenses;
create policy "staff delete expenses" on public.expenses
  for delete to authenticated using (public.current_user_has_clinic_role());

drop policy if exists "staff read appointments" on public.appointments;
create policy "staff read appointments" on public.appointments
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "staff insert appointments" on public.appointments;
create policy "staff insert appointments" on public.appointments
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "staff update appointments" on public.appointments;
create policy "staff update appointments" on public.appointments
  for update to authenticated
  using (public.current_user_has_clinic_role())
  with check (public.current_user_has_clinic_role());

drop policy if exists "authenticated staff read followups" on public.followups;
create policy "authenticated staff read followups" on public.followups
  for select to authenticated using (public.current_user_has_clinic_role());
drop policy if exists "authenticated staff insert followups" on public.followups;
create policy "authenticated staff insert followups" on public.followups
  for insert to authenticated with check (public.current_user_has_clinic_role());
drop policy if exists "authenticated staff update followups" on public.followups;
create policy "authenticated staff update followups" on public.followups
  for update to authenticated
  using (public.current_user_has_clinic_role())
  with check (public.current_user_has_clinic_role());
