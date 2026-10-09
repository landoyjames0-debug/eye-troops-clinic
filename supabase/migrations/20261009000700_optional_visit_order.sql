create or replace function public.create_visit_order_transaction(
  p_patient_id uuid,
  p_new_patient jsonb,
  p_visit_date timestamptz,
  p_visit_notes text,
  p_prescription jsonb,
  p_description text,
  p_total_amount numeric,
  p_order_date date,
  p_initial_payment numeric,
  p_payment_date date,
  p_payment_notes text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request jsonb;
  v_request_fingerprint text;
  v_transaction public.visit_order_transactions%rowtype;
  v_patient public.patients%rowtype;
  v_visit public.visits%rowtype;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_total numeric(12, 2);
  v_initial_payment numeric(12, 2);
  v_year integer;
  v_sequence bigint;
  v_order_number text;
begin
  if auth.uid() is null or not public.current_user_has_clinic_role() then
    raise exception 'An authorized clinic profile is required to save a visit.'
      using errcode = '42501';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required.'
      using errcode = '22023';
  end if;

  if (p_patient_id is null) = (p_new_patient is null) then
    raise exception 'Provide either an existing patient or a new patient.'
      using errcode = '22023';
  end if;

  if p_new_patient is not null and jsonb_typeof(p_new_patient) <> 'object' then
    raise exception 'New patient details must be an object.'
      using errcode = '22023';
  end if;

  if p_visit_date is null or p_order_date is null then
    raise exception 'Visit and transaction dates are required.'
      using errcode = '22023';
  end if;

  if p_total_amount is not null and p_total_amount < 0 then
    raise exception 'Order total cannot be negative.'
      using errcode = '22023';
  end if;

  v_total := case
    when p_total_amount is null then null
    else round(p_total_amount, 2)
  end;
  v_initial_payment := round(coalesce(p_initial_payment, 0), 2);

  if v_initial_payment < 0
    or (v_total is null and v_initial_payment > 0)
    or (v_total is not null and v_initial_payment > v_total) then
    raise exception 'Initial payment must be zero without an order and cannot exceed the order total.'
      using errcode = '23514';
  end if;

  v_request := jsonb_build_object(
    'patient_id', p_patient_id,
    'new_patient', p_new_patient,
    'visit_date', p_visit_date,
    'visit_notes', p_visit_notes,
    'prescription', p_prescription,
    'description', p_description,
    'total_amount', v_total,
    'order_date', p_order_date,
    'initial_payment', v_initial_payment,
    'payment_date', p_payment_date,
    'payment_notes', p_payment_notes
  );
  v_request_fingerprint := md5(v_request::text);

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_transaction
  from public.visit_order_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    if v_transaction.request_fingerprint is distinct from v_request_fingerprint then
      raise exception 'Idempotency key was already used for different visit details.'
        using errcode = '22023';
    end if;

    select * into v_patient from public.patients where id = v_transaction.patient_id;
    select * into v_visit from public.visits where id = v_transaction.visit_id;
    if v_transaction.order_id is not null then
      select * into v_order from public.orders where id = v_transaction.order_id;
    end if;
    if v_transaction.payment_id is not null then
      select * into v_payment from public.payments where id = v_transaction.payment_id;
    end if;

    return jsonb_build_object(
      'patient', to_jsonb(v_patient),
      'visit', to_jsonb(v_visit),
      'order', case when v_transaction.order_id is null then null else to_jsonb(v_order) end,
      'payment', case when v_transaction.payment_id is null then null else to_jsonb(v_payment) end
    );
  end if;

  insert into public.visit_order_transactions (idempotency_key, request_fingerprint)
  values (p_idempotency_key, v_request_fingerprint);

  if p_patient_id is null then
    if nullif(btrim(p_new_patient ->> 'full_name'), '') is null then
      raise exception 'Patient name is required.' using errcode = '22023';
    end if;

    insert into public.patients (full_name, cp_number, address, notes)
    values (
      btrim(p_new_patient ->> 'full_name'),
      nullif(btrim(p_new_patient ->> 'cp_number'), ''),
      nullif(btrim(p_new_patient ->> 'address'), ''),
      nullif(btrim(p_new_patient ->> 'notes'), '')
    )
    returning * into v_patient;
  else
    select * into v_patient from public.patients where id = p_patient_id;
    if not found then
      raise exception 'Patient not found.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.visits (patient_id, visit_date, notes)
  values (v_patient.id, p_visit_date, nullif(btrim(p_visit_notes), ''))
  returning * into v_visit;

  if p_prescription is not null then
    insert into public.prescriptions (
      visit_id, od_sph, od_cyl, od_axis, od_add, od_pd,
      os_sph, os_cyl, os_axis, os_add, os_pd
    ) values (
      v_visit.id,
      nullif(btrim(p_prescription ->> 'od_sph'), ''),
      nullif(btrim(p_prescription ->> 'od_cyl'), ''),
      nullif(btrim(p_prescription ->> 'od_axis'), ''),
      nullif(btrim(p_prescription ->> 'od_add'), ''),
      nullif(btrim(p_prescription ->> 'od_pd'), ''),
      nullif(btrim(p_prescription ->> 'os_sph'), ''),
      nullif(btrim(p_prescription ->> 'os_cyl'), ''),
      nullif(btrim(p_prescription ->> 'os_axis'), ''),
      nullif(btrim(p_prescription ->> 'os_add'), ''),
      nullif(btrim(p_prescription ->> 'os_pd'), '')
    );
  end if;

  if v_total is not null then
    v_year := extract(year from p_order_date)::integer;
    perform pg_advisory_xact_lock(hashtextextended('order-number:' || v_year::text, 0));
    select count(*) + 1 into v_sequence
    from public.orders
    where order_date >= make_date(v_year, 1, 1)
      and order_date < make_date(v_year + 1, 1, 1);
    v_order_number := format('ET-%s-%s', v_year, lpad(v_sequence::text, 5, '0'));

    insert into public.orders (
      order_number, patient_id, visit_id, description, total_amount, status, order_date
    ) values (
      v_order_number,
      v_patient.id,
      v_visit.id,
      nullif(btrim(p_description), ''),
      v_total,
      'ORDERED',
      p_order_date
    )
    returning * into v_order;

    if v_initial_payment > 0 then
      if p_payment_date is null then
        raise exception 'Payment date is required for an initial payment.'
          using errcode = '22023';
      end if;
      insert into public.payments (
        order_id, amount, payment_date, notes, idempotency_key
      ) values (
        v_order.id, v_initial_payment, p_payment_date,
        nullif(btrim(p_payment_notes), ''), p_idempotency_key
      )
      returning * into v_payment;
    end if;
  end if;

  update public.visit_order_transactions
  set patient_id = v_patient.id,
      visit_id = v_visit.id,
      order_id = v_order.id,
      payment_id = v_payment.id
  where idempotency_key = p_idempotency_key;

  return jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'visit', to_jsonb(v_visit),
    'order', case when v_order.id is null then null else to_jsonb(v_order) end,
    'payment', case when v_payment.id is null then null else to_jsonb(v_payment) end
  );
end;
$$;

revoke all on function public.create_visit_order_transaction(
  uuid, jsonb, timestamptz, text, jsonb, text, numeric, date, numeric, date, text, uuid
) from public, anon;
grant execute on function public.create_visit_order_transaction(
  uuid, jsonb, timestamptz, text, jsonb, text, numeric, date, numeric, date, text, uuid
) to authenticated;
