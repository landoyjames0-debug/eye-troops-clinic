# Eye Troops clinic feature roadmap

## Goal

Build the app into a practical optical clinic operations system by prioritizing the features that improve patient flow, prescription management, and appointment scheduling.

## Recommended sequence

### Phase 1 — Patient search + patient profile

Priority: highest

1. Global patient search in the sidebar and patient list
2. Search by name, CP number, and phone number
3. Fast patient profile drawer with:
   - patient info
   - outstanding balance
   - last visit
   - prescription history
   - order history
4. Direct action links to:
   - New visit
   - Edit patient
   - View patient details

Acceptance criteria:

- Staff can find a patient in under 3 seconds
- Search supports name and CP/mobile lookup
- The patient record opens without page reload
- Recent history is visible immediately

---

### Phase 2 — Prescription workflow

Priority: highest

1. Add a prescription section to each patient profile
2. Attach one prescription to each visit
3. Show latest prescription in the patient summary card
4. Show full prescription table by visit
5. Add a printable prescription view

Suggested patient UX:

- Patient details panel displays latest prescription at the top
- Each visit entry shows prescription values for OD/OS
- Latest prescription is easy to compare against previous visits

Prescription fields:

- od_sph
- od_cyl
- od_axis
- od_add
- od_pd
- os_sph
- os_cyl
- os_axis
- os_add
- os_pd
- notes

Acceptance criteria:

- Each visit can carry a prescription record
- Latest prescription is visible without opening a separate page
- Previous prescriptions remain readable as history
- Print-friendly view is available for the final prescription

---

### Phase 3 — Appointments

Priority: high

1. Add appointment table and calendar view
2. Book appointment from patient record
3. Reschedule and cancel flows
4. Mark no-show and completed visits
5. Show appointment history on the patient profile

Core appointment fields:

- id
- patient_id
- staff_id (optional)
- appointment_date
- start_time
- duration_minutes
- type
- status
- notes
- reminder_sent_at

Acceptance criteria:

- Staff can book, reschedule, cancel, and complete appointments
- Patient profile shows future and past appointments
- Appointment status is clear and reportable
- Reminder status can be tracked

---

### Phase 4 — Receipts and invoices

Priority: high

1. Generate printable receipt for each payment
2. Generate invoice for order balances
3. Partial payment support
4. Outstanding balance summary
5. Payment history grouped by patient and date

Acceptance criteria:

- Completion of order and payment updates patient balance immediately
- Receipt includes clinic branding and patient details
- Invoice can be printed or exported

---

### Phase 5 — Inventory

Priority: medium

1. Product catalog for frames, lenses, contact lenses, accessories
2. Quantity tracking
3. Low stock alerts
4. Stock reduction when assigned to an order

Suggested inventory fields:

- id
- sku
- category
- name
- brand
- unit_cost
- selling_price
- stock_on_hand
- reorder_level
- is_active

Acceptance criteria:

- Inventory is linked to order line items
- Stock can be tracked per item and category
- Low-stock alerts are visible

---

### Phase 6 — Reminder automation

Priority: medium

1. Appointment reminders
2. Ready-for-pickup reminders
3. Follow-up check reminder after completed visits
4. Reminder delivery status tracking

Acceptance criteria:

- Patients are reminded for upcoming visits and pickup dates
- Reminder send status is logged
- Failed sends can be retried or reviewed

---

### Phase 7 — Dashboard and reports

Priority: medium

1. Daily collection summary
2. Monthly sales dashboard
3. Outstanding balance report
4. Appointment summary by day/week
5. Inventory movement report

Acceptance criteria:

- Owner can see actual clinic performance by date range
- Totals match ledger and payments
- Reports are filterable by patient, staff, or date

---

## Suggested implementation order for this app

### First milestone: patient ops

- patient search
- patient profile drawer
- prescription history
- latest prescription summary

### Second milestone: scheduling

- appointment booking
- appointment calendar
- reminder state

### Third milestone: financial ops

- receipt/invoice generation
- balance tracking
- payment flow cleanup

### Fourth milestone: inventory + reporting

- stock tracking
- low-stock alerts
- owner reporting

---

## Recommended database structure

### patients

```sql
CREATE TABLE patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cp_number text,
  address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### visits

```sql
CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  visit_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### prescriptions

```sql
CREATE TABLE prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id),
  od_sph text,
  od_cyl text,
  od_axis text,
  od_add text,
  od_pd text,
  os_sph text,
  os_cyl text,
  os_axis text,
  os_add text,
  os_pd text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### appointments

```sql
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  type text NOT NULL DEFAULT 'Consultation',
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

---

## Exact next implementation target

For the current app, the best immediate build is:

1. patient search
2. patient prescription history
3. appointment scheduling

This gives the app the biggest practical clinic value without destabilizing the current sales and payments flow.
