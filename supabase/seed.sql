-- Eye TroOps Optical Clinic — sample data
--
-- Fictional records only. Safe to run in development.
--
--   supabase db reset
--
-- This does NOT create login accounts. Create the first staff user in
-- Supabase Studio → Authentication → Users, then it appears in public.users
-- automatically via the on_auth_user_created trigger.

-- ── Patients ─────────────────────────────────────────────────────────────
insert into public.patients (id, full_name, cp_number, address, notes) values
  ('11111111-1111-4111-8111-111111111111', 'Maria Santos',      '09171234567', '24 Kalachuchi St, Quezon City', 'Prefers progressive lenses.'),
  ('22222222-2222-4222-8222-222222222222', 'John Dela Cruz',   '09281234567', '118 Katipunan Ave, Quezon City', null),
  ('33333333-3333-4333-8333-333333333333', 'Angela Reyes',     '09182345678', '7 Batasan Hills, Caloocan',      'Contact lens solution refill every 6 months.'),
  ('44444444-4444-4444-8444-444444444444', 'Mark Villanueva',  '09293456789', '221 Mabini St, Manila',           'Always claims on weekends.'),
  ('55555555-5555-4555-8555-555555555555', 'Rowan Bautista',   '09304567890', '55 Taft Ave, Pasay',              null),
  ('66666666-6666-4666-8666-666666666666', 'Camille Mendoza',  '09315678901', '12 Ortigas Ave, Pasig',          'Sensitive to metal frames.');

-- ── Visits (dates are relative to the day the seed runs) ─────────────────
insert into public.visits (id, patient_id, visit_date, notes) values
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', now() - interval '14 days', 'Routine eye exam.'),
  ('a2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', now() - interval '10 days', 'Progressive fitting.'),
  ('a3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', now() - interval '8 days',  'Contact lens check.'),
  ('a4444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444444', now() - interval '6 days',  'Claimed previous order.'),
  ('a5555555-5555-4555-8555-555555555555', '55555555-5555-4555-8555-555555555555', now() - interval '3 days',  'Single-vision reading glasses.'),
  ('a6666666-6666-4666-8666-666666666666', '66666666-6666-4666-8666-666666666666', now() - interval '1 day',   'Titanium frame fitting.');

-- ── Prescriptions ────────────────────────────────────────────────────────
insert into public.prescriptions (visit_id, od_sph, od_cyl, od_axis, od_add, od_pd, os_sph, os_cyl, os_axis, os_add, os_pd) values
  ('a1111111-1111-4111-8111-111111111111', '-1.25', '-0.50', '180', '+1.00', '31.0', '-1.50', '-0.25', '175', '+1.00', '31.0'),
  ('a2222222-2222-4222-8222-222222222222', '-2.00', '-0.75', '85',  '+1.75', '32.0', '-2.25', '-0.50', '90',  '+1.75', '32.0'),
  ('a3333333-3333-4333-8333-333333333333', '-0.75', null,    null,  null,    '30.5', '-0.75', null,    null,  null,    '30.5'),
  ('a4444444-4444-4444-8444-444444444444', '+1.00', null,    null,  null,    '30.0', '+1.00', null,    null,  null,    '30.0'),
  ('a5555555-5555-4555-8555-555555555555', '+2.00', null,    null,  null,    '30.0', '+2.25', null,    null,  null,    '30.0'),
  ('a6666666-6666-4666-8666-666666666666', '-3.00', '-1.00', '100', '+2.00', '32.5', '-3.25', '-0.75', '80',  '+2.00', '32.5');

-- ── Orders ───────────────────────────────────────────────────────────────
insert into public.orders (id, order_number, patient_id, visit_id, description, total_amount, status, order_date) values
  ('b1111111-1111-4111-8111-111111111111', 'ET-2026-00124', '11111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'Complete progressive glasses — gold titanium frame', 5500.00, 'IN_LAB',          current_date - 14),
  ('b2222222-2222-4222-8222-222222222222', 'ET-2026-00123', '22222222-2222-4222-8222-222222222222', 'a2222222-2222-4222-8222-222222222222', 'Progressive lenses — acetate frame',                 6200.00, 'ORDERED',         current_date - 10),
  ('b3333333-3333-4333-8333-333333333333', 'ET-2026-00122', '33333333-3333-4333-8333-333333333333', 'a3333333-3333-4333-8333-333333333333', 'Contact lens supply — 3-month',                      1800.00, 'READY_FOR_PICKUP', current_date - 8),
  ('b4444444-4444-4444-8444-444444444444', 'ET-2026-00121', '44444444-4444-4444-8444-444444444444', 'a4444444-4444-4444-8444-444444444444', 'Reading glasses +2.00 — metal frame',                 2400.00, 'CLAIMED',         current_date - 6),
  ('b5555555-5555-4555-8555-555555555555', 'ET-2026-00120', '55555555-5555-4555-8555-555555555555', 'a5555555-5555-4555-8555-555555555555', 'Single-vision reading glasses',                      1950.00, 'READY_FOR_PICKUP', current_date - 3),
  ('b6666666-6666-4666-8666-666666666666', 'ET-2026-00119', '66666666-6666-4666-8666-666666666666', 'a6666666-6666-4666-8666-666666666666', 'Titanium frame with progressive lenses',             9800.00, 'READY_FOR_PICKUP', current_date - 1);

-- ── Payments (append-only; sales = SUM(amount) by payment_date) ─────────
insert into public.payments (order_id, amount, payment_date, notes) values
  ('b1111111-1111-4111-8111-111111111111', 2500.00, current_date - 14, 'Deposit'),
  ('b1111111-1111-4111-8111-111111111111', 3000.00, current_date,      'Balance on pickup'),
  ('b2222222-2222-4222-8222-222222222222', 2500.00, current_date,      'Deposit'),
  ('b3333333-3333-4333-8333-333333333333', 1800.00, current_date - 8,  'Paid in full'),
  ('b4444444-4444-4444-8444-444444444444', 2400.00, current_date - 6,  'Paid in full'),
  ('b5555555-5555-4555-8555-555555555555', 1950.00, current_date,      'Paid in full'),
  ('b6666666-6666-4666-8666-666666666666', 4000.00, current_date - 1,  'Deposit');

-- ── Expenses ─────────────────────────────────────────────────────────────
insert into public.expenses (expense_date, category, amount, description) values
  (current_date,     'Electricity',       2350.00, 'Meralco — month to date'),
  (current_date,     'Supplier',          1800.00, 'Frames restock — Asian Optical'),
  (current_date,     'Optician',          4500.00, 'Lab fee — in-progress orders'),
  (current_date - 1, 'Rent',            25000.00, 'Clinic rent'),
  (current_date - 2, 'Opto',             3200.00, 'Slit lamp supplies'),
  (current_date - 3, 'Sales Associate', 12000.00, 'Associate commission'),
  (current_date - 5, 'Water',              890.00, 'Water bill'),
  (current_date - 7, 'Supplier',          6400.00, 'Lens stock order'),
  (current_date - 9, 'Other',             1250.00, 'Clinic cleaning supplies');
