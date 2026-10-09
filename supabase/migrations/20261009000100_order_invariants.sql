create or replace function public.enforce_order_invariants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_paid numeric(12, 2);
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'ORDERED' and new.status in ('IN_LAB', 'CANCELLED'))
      or (old.status = 'IN_LAB' and new.status in ('READY_FOR_PICKUP', 'CANCELLED'))
      or (old.status = 'READY_FOR_PICKUP' and new.status in ('CLAIMED', 'CANCELLED'))
    ) then
      raise exception 'Invalid order status transition from % to %.', old.status, new.status
        using errcode = '23514';
    end if;
  end if;

  if new.total_amount is distinct from old.total_amount then
    select coalesce(sum(amount), 0)::numeric(12, 2) into v_paid
    from public.payments
    where order_id = old.id
      and status = 'COMPLETED';

    if new.total_amount < v_paid then
      raise exception 'Order total cannot be less than completed payments.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_invariants on public.orders;
create trigger orders_enforce_invariants
  before update of status, total_amount on public.orders
  for each row execute function public.enforce_order_invariants();
