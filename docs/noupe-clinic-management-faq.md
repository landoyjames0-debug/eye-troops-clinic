# Eye TroOps Clinic Management FAQ

Chatbot-ready FAQ for clinic staff. Answers describe the current website. Do not ask users to share passwords, authentication codes, or payment details in chat. If access or a record needs administrator help, direct the user to the clinic administrator.

## Getting started

Q: What is Eye TroOps Clinic Management?
A: It is the clinic website for managing patient records, visits, prescriptions, appointments, optical orders, payments, sales, and expenses.

Q: How do I sign in?
A: Open the clinic website and sign in with your staff account. If you cannot access your account, contact the clinic administrator.

Q: What can I see on Today?
A: Today shows clinic activity, collections, sales and expenses, outstanding balances, pickups due, and follow-ups due. Select a summary tile to open its related section.

Q: Can I use the website on a phone or tablet?
A: Yes. The website has responsive layouts for desktop, tablet, and mobile.

Q: How do I install Eye TroOps on my device?
A: On your first visit, choose Install app in the prompt. If the prompt is not available, open the browser menu and choose Install Eye TroOps or Install this site as an app. On iPhone or iPad, open the site in Safari, tap Share, then Add to Home Screen. Installation adds an app shortcut; clinic records still require an internet connection.

## Patients

Q: How do I find a patient?
A: Open Patients and search by the patient's name or mobile/CP number. Select the patient to view their visits, prescriptions, orders, payments, and balance.

Q: How do I add a patient?
A: Open New Visit, choose the new-patient option, and enter the patient's name and mobile number. Complete the visit details and save. You can turn off order creation if this visit does not need an order.

Q: How do I edit patient information?
A: Open Patients, select the patient, choose Edit, update the information, and save.

Q: What does Archive Patient do?
A: Archiving hides the patient from the active roster but keeps their visits, prescriptions, orders, and payments on record. It does not permanently delete the patient's history. Contact an administrator if an archived patient needs to be restored.

Q: Does archiving change the patient's balance or payment history?
A: No. Archiving only removes the patient from the active roster. Financial and visit history remains on record.

## Visits and prescriptions

Q: How do I record a visit?
A: Open New Visit, select an existing patient or enter a new patient's details, set the visit date and time, add notes or prescription values, and save. Visit dates cannot be in the future.

Q: Can I save a visit without an order?
A: Yes. In the Order section, turn off Create an order for this visit. The patient and visit are saved without an order or payment.

Q: Can I collect a payment without creating an order?
A: No. Payments are attached to an order. Enable order creation and add order items before entering a payment.

Q: Can I add a prescription without an order?
A: Yes. A prescription belongs to the visit, so you can save the visit and prescription with order creation turned off.

Q: Can I record a future visit in New Visit?
A: No. New Visit records a visit that has already occurred. Use Appointments to schedule a future appointment.

## Appointments

Q: How do I schedule an appointment?
A: Open Appointments, select a patient, choose a date and time, set the duration and appointment type, add optional notes, and save. The schedule checks for overlapping appointments.

Q: How do I change an appointment?
A: Choose Edit on the appointment, update its details, and save. If the new time overlaps another appointment, choose a different time.

Q: What appointment statuses are available?
A: Appointments can be Scheduled, Arrived (shown as Checked In in stored data), Completed, No Show, or Cancelled.

Q: How do I cancel an appointment?
A: Choose Cancel on an eligible upcoming appointment and confirm. The appointment remains on record with a Cancelled status.

Q: Can I permanently delete an appointment?
A: Yes. Choose Delete and confirm Delete permanently. This cannot be undone. Any follow-up linked to that appointment is also deleted.

Q: Does the system send appointment reminders automatically?
A: No automatic SMS or email reminder is currently provided. Staff can review upcoming appointments and contact patients using the clinic's usual process.

## Orders, payments, and balances

Q: Why is the Orders & Balances table grouped by patient?
A: The table shows one row per patient to keep it compact. Select a patient to see each order separately, including its status, total, payments, and balance.

Q: How do I open an order?
A: In Orders & Balances, select the patient row. In the patient drawer, choose View order beside the specific order.

Q: How do I record a payment for an order?
A: Open the patient in Orders & Balances, select View order for the correct order, then choose Add payment. Enter the amount, date, method, and optional notes, then confirm. A payment cannot exceed the current balance.

Q: How is an order balance calculated?
A: Balance is the order total minus its completed payments. Voided or refunded payments do not count as paid.

Q: What does Completed mean on an order?
A: Completed is the payment label shown when the order is paid in full. It is separate from fulfillment status. Fulfillment still uses Ordered, In Lab, Ready for Pickup, and Claimed.

Q: How do I update an order's fulfillment status?
A: Open View order and select the next step in the status progress: Ordered, In Lab, Ready for Pickup, then Claimed. Orders cannot skip forward steps.

Q: How do I cancel an order?
A: Select Cancel order beside an active order in the patient drawer, or open the order and choose Cancel order. Confirm the action. The order stays in the records and its payments remain in the ledger, but it no longer counts toward outstanding balances. Claimed or already-cancelled orders cannot be cancelled again.

Q: Can I permanently delete an order?
A: The current workflow cancels orders rather than permanently deleting them, to preserve financial history.

Q: What should I do if a payment was entered incorrectly?
A: Open the order's payment history and choose the void action for the incorrect payment. A voided payment remains visible for audit purposes but no longer counts toward paid amounts or sales totals. Record a corrected payment separately if needed.

Q: Why does a cancelled order still appear in payment history or sales?
A: Cancelling an order does not remove or void its payments. Completed payments remain in the ledger and count toward sales until they are voided or refunded.

Q: What does Ready for Pickup mean?
A: The order has been marked ready and is waiting for the patient. Ready orders appear in the pickup list on Today.

Q: Can I print an order receipt?
A: Open the order and choose Print receipt.

## Sales, expenses, and backups

Q: How are sales calculated?
A: Sales are based on completed payments by payment date, not the order's full price. A deposit counts as the amount received; the remaining balance is not counted as sales until it is paid.

Q: How do I view a different finance period?
A: Open Sales & Expenses and choose a date range such as today, this week, this month, this quarter, this year, or a custom range. You can also filter the year and month.

Q: How do I add or edit an expense?
A: Open Sales & Expenses, choose Add expense, and enter the date, category, amount, and optional description. Use Edit on an expense row to change it.

Q: Can I delete an expense?
A: Yes. Choose Delete on the expense and confirm. Deleting an expense changes expense and net totals.

Q: Can I export finance data?
A: Yes. Use Export CSV in the Sales or Expenses section. Exports respect the selected date period and current search.

Q: Who can download a database backup?
A: The Data backup control is available to administrator accounts in Profile & Settings. It downloads clinic tables as CSV files in a ZIP archive.

## Limitations and help

Q: Does the website manage frame or lens inventory?
A: No. Inventory and stock tracking are not currently available. Order item descriptions and prices can be recorded, but stock is not deducted or monitored.

Q: What should I do if something does not save?
A: Check your connection and try again once. If the error continues, note the page, action, and exact error message, then contact the clinic administrator. Do not submit the same payment repeatedly while its status is unclear.

Q: Who should I contact for account access or a missing permission?
A: Contact the clinic administrator. Do not send your password or authentication codes through chat.
