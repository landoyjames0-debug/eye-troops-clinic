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

alter table public.payments
  add column if not exists idempotency_key uuid;

create unique index if not exists payments_idempotency_key_uidx
  on public.payments (idempotency_key)
  where idempotency_key is not null;

create or replace function public.record_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_notes text,
  p_idempotency_key uuid
)
returns setof public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.payments%rowtype;
  v_order public.orders%rowtype;
  v_paid numeric(12, 2);
  v_payment public.payments%rowtype;
begin
  if auth.uid() is null or not public.current_user_has_clinic_role() then
    raise exception 'An authorized clinic profile is required to record a payment.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required.'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.'
      using errcode = '22023';
  end if;

  if p_payment_date is null then
    raise exception 'Payment date is required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.payments
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.order_id is distinct from p_order_id
      or v_existing.amount is distinct from p_amount
      or v_existing.payment_date is distinct from p_payment_date
      or v_existing.notes is distinct from p_notes then
      raise exception 'Idempotency key was already used for different payment details.'
        using errcode = '22023';
    end if;
    return query select v_existing.*;
    return;
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0)::numeric(12, 2) into v_paid
  from public.payments
  where order_id = p_order_id
    and status = 'COMPLETED';

  if p_amount > v_order.total_amount - v_paid then
    raise exception 'Payment exceeds the remaining order balance.'
      using errcode = '23514';
  end if;

  insert into public.payments (
    order_id,
    amount,
    payment_date,
    notes,
    idempotency_key
  ) values (
    p_order_id,
    p_amount,
    p_payment_date,
    p_notes,
    p_idempotency_key
  )
  returning * into v_payment;

  return query select v_payment.*;
end;
$$;

revoke all on function public.record_order_payment(uuid, numeric, date, text, uuid)
  from public, anon;
grant execute on function public.record_order_payment(uuid, numeric, date, text, uuid)
  to authenticated;

revoke insert (order_id, amount, payment_date, notes) on public.payments
  from authenticated;
