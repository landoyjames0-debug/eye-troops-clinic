-- Phase 3 rollback. Run only if reverting the application deployment as well.
-- Operational rows created by the RPCs are preserved; the idempotency metadata
-- table and payment idempotency keys are removed.

-- Remove role-policy dependencies first, but retain the helper until both RPCs
-- that call it have been removed below.
drop policy if exists "staff update own profile" on public.users;
drop policy if exists "staff read patients" on public.patients;
drop policy if exists "staff insert patients" on public.patients;
drop policy if exists "staff update patients" on public.patients;
drop policy if exists "staff read visits" on public.visits;
drop policy if exists "staff insert visits" on public.visits;
drop policy if exists "staff rollback own visits" on public.visits;
drop policy if exists "staff read prescriptions" on public.prescriptions;
drop policy if exists "staff insert prescriptions" on public.prescriptions;
drop policy if exists "staff read orders" on public.orders;
drop policy if exists "staff insert orders" on public.orders;
drop policy if exists "staff update orders" on public.orders;
drop policy if exists "staff read payments" on public.payments;
drop policy if exists "staff insert payments" on public.payments;
drop policy if exists "staff void completed payments" on public.payments;
drop policy if exists "staff read order status history" on public.order_status_history;
drop policy if exists "staff read expenses" on public.expenses;
drop policy if exists "staff insert expenses" on public.expenses;
drop policy if exists "staff update expenses" on public.expenses;
drop policy if exists "staff delete expenses" on public.expenses;
drop policy if exists "staff read appointments" on public.appointments;
drop policy if exists "staff insert appointments" on public.appointments;
drop policy if exists "staff update appointments" on public.appointments;
drop policy if exists "authenticated staff read followups" on public.followups;
drop policy if exists "authenticated staff insert followups" on public.followups;
drop policy if exists "authenticated staff update followups" on public.followups;

create policy "staff update own profile" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "staff read patients" on public.patients
  for select to authenticated using (true);
create policy "staff insert patients" on public.patients
  for insert to authenticated with check (true);
create policy "staff update patients" on public.patients
  for update to authenticated using (true) with check (true);
create policy "staff read visits" on public.visits
  for select to authenticated using (true);
create policy "staff insert visits" on public.visits
  for insert to authenticated with check (true);
create policy "staff rollback own visits" on public.visits
  for delete to authenticated using (created_by = auth.uid());
create policy "staff read prescriptions" on public.prescriptions
  for select to authenticated using (true);
create policy "staff insert prescriptions" on public.prescriptions
  for insert to authenticated with check (true);
create policy "staff read orders" on public.orders
  for select to authenticated using (true);
create policy "staff insert orders" on public.orders
  for insert to authenticated with check (true);
create policy "staff update orders" on public.orders
  for update to authenticated using (true) with check (true);
create policy "staff read payments" on public.payments
  for select to authenticated using (true);
create policy "staff insert payments" on public.payments
  for insert to authenticated with check (true);
create policy "staff void completed payments" on public.payments
  for update to authenticated
  using (status = 'COMPLETED')
  with check (status = 'VOIDED' and voided_at is not null);
create policy "staff read order status history" on public.order_status_history
  for select to authenticated using (true);
create policy "staff read expenses" on public.expenses
  for select to authenticated using (true);
create policy "staff insert expenses" on public.expenses
  for insert to authenticated with check (true);
create policy "staff update expenses" on public.expenses
  for update to authenticated using (true) with check (true);
create policy "staff delete expenses" on public.expenses
  for delete to authenticated using (true);
create policy "staff read appointments" on public.appointments
  for select to authenticated using (true);
create policy "staff insert appointments" on public.appointments
  for insert to authenticated with check (true);
create policy "staff update appointments" on public.appointments
  for update to authenticated using (true) with check (true);
create policy "authenticated staff read followups" on public.followups
  for select to authenticated using (true);
create policy "authenticated staff insert followups" on public.followups
  for insert to authenticated with check (true);
create policy "authenticated staff update followups" on public.followups
  for update to authenticated using (true) with check (true);

-- Restore atomic-visit direct grants and remove the atomic transaction API.
revoke execute on function public.create_visit_order_transaction(
  uuid, jsonb, timestamptz, text, jsonb, text, numeric, date, numeric, date, text, uuid
) from authenticated;
drop function if exists public.create_visit_order_transaction(
  uuid, jsonb, timestamptz, text, jsonb, text, numeric, date, numeric, date, text, uuid
);
drop table if exists public.visit_order_transactions;
grant insert (patient_id, visit_date, notes) on public.visits to authenticated;
grant delete on public.visits to authenticated;
grant insert (
  visit_id, od_sph, od_cyl, od_axis, od_add, od_pd,
  os_sph, os_cyl, os_axis, os_add, os_pd
) on public.prescriptions to authenticated;
grant insert (order_number, patient_id, visit_id, description, total_amount, status, order_date)
  on public.orders to authenticated;

-- Restore the original payment insert path and remove payment idempotency.
revoke execute on function public.record_order_payment(uuid, numeric, date, text, uuid)
  from authenticated;
drop function if exists public.record_order_payment(uuid, numeric, date, text, uuid);
grant insert (order_id, amount, payment_date, notes) on public.payments to authenticated;
drop index if exists public.payments_idempotency_key_uidx;
alter table public.payments drop column if exists idempotency_key;

-- Remove atomic order cancellation and its metadata guard.
revoke execute on function public.delete_appointment(uuid) from authenticated;
drop function if exists public.delete_appointment(uuid);
revoke execute on function public.cancel_order(uuid, text) from authenticated;
drop function if exists public.cancel_order(uuid, text);
drop trigger if exists orders_require_cancellation_metadata on public.orders;
drop function if exists public.require_order_cancellation_metadata();
alter table public.orders
  drop column if exists cancellation_reason,
  drop column if exists cancelled_by,
  drop column if exists cancelled_at;

-- Remove order transition / total guardrails.
drop trigger if exists orders_enforce_invariants on public.orders;
drop function if exists public.enforce_order_invariants();

-- Remove role triggers and helper after all policies and RPCs have stopped using it.
drop trigger if exists patients_require_clinic_role on public.patients;
drop trigger if exists visits_require_clinic_role on public.visits;
drop trigger if exists prescriptions_require_clinic_role on public.prescriptions;
drop trigger if exists orders_require_clinic_role on public.orders;
drop trigger if exists payments_require_clinic_role on public.payments;
drop trigger if exists order_status_history_require_clinic_role on public.order_status_history;
drop trigger if exists expenses_require_clinic_role on public.expenses;
drop trigger if exists appointments_require_clinic_role on public.appointments;
drop trigger if exists followups_require_clinic_role on public.followups;
drop function if exists public.enforce_clinic_role_on_write();
drop function if exists public.current_user_has_clinic_role();
