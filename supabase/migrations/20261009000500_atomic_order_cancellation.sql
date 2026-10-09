begin;

alter table public.orders
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.users (id) on delete set null,
  add column if not exists cancellation_reason text;

create or replace function public.require_order_cancellation_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from new.status
    and new.status = 'CANCELLED'
    and (new.cancelled_at is null or new.cancelled_by is null) then
    raise exception 'Cancel orders through the cancel_order function.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_require_cancellation_metadata on public.orders;
create trigger orders_require_cancellation_metadata
  before update of status on public.orders
  for each row execute function public.require_order_cancellation_metadata();

create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason text default null
)
returns setof public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null or not public.current_user_has_clinic_role() then
    raise exception 'An authorized clinic profile is required to cancel an order.'
      using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  if v_order.status = 'CLAIMED' then
    raise exception 'A claimed order cannot be cancelled.'
      using errcode = '23514';
  end if;

  if v_order.status = 'CANCELLED' then
    raise exception 'This order is already cancelled.'
      using errcode = '23514';
  end if;

  update public.orders
  set status = 'CANCELLED',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = nullif(btrim(p_reason), '')
  where id = p_order_id
  returning * into v_order;

  return next v_order;
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

commit;
