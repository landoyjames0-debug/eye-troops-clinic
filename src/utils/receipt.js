import { isCompletedPayment } from '@/services/orders.service'
import { paymentMethodOf, paymentNoteOf } from '@/lib/constants'
import { formatDate, formatPeso } from '@/utils/format'
import { formatAge } from '@/utils/age'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function receiptHtml(order, patient) {
  const payments = (order.payments ?? []).filter(isCompletedPayment)
  const describe = (payment) =>
    [paymentMethodOf(payment), paymentNoteOf(payment)].filter(Boolean).join(' · ')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Receipt ${escapeHtml(order.order_number)}</title>
    <style>
      @page { margin: 12mm; }
      body { font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; color: #3F3328; font-size: 12px; margin: 0; }
      .wrap { max-width: 320px; margin: 0 auto; }
      .head { text-align: center; border-bottom: 2px solid #B8893D; padding-bottom: 12px; margin-bottom: 14px; }
      .mark { width: 40px; height: 40px; margin: 0 auto 6px; border: 2px solid #B8893D; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: #B8893D; }
      h1 { font-size: 15px; margin: 0; letter-spacing: 0.04em; text-transform: uppercase; }
      .muted { color: #75695D; font-size: 10px; margin-top: 2px; }
      dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0 0 12px; }
      dt { color: #75695D; }
      dd { margin: 0; text-align: right; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      th, td { text-align: left; padding: 3px 0; border-bottom: 1px solid #E7D9C5; }
      th { color: #75695D; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
      td.amount, th.amount { text-align: right; font-variant-numeric: tabular-nums; }
      .totals { margin-top: 6px; }
      .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
      .grand { border-top: 2px solid #B8893D; margin-top: 4px; padding-top: 6px; font-weight: 700; font-size: 14px; }
      .foot { margin-top: 16px; text-align: center; color: #75695D; font-size: 11px; }
      @media print { .no-print { display: none; } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="head">
        <div class="mark">ET</div>
        <h1>Eye Troops Optical Clinic</h1>
        <div class="muted">Official Receipt</div>
      </div>

      <dl>
        <dt>Receipt no.</dt><dd>${escapeHtml(order.order_number)}</dd>
        <dt>Date</dt><dd>${escapeHtml(formatDate(order.order_date))}</dd>
        <dt>Patient</dt><dd>${escapeHtml(patient?.full_name ?? '—')}</dd>
        <dt>Age</dt><dd>${escapeHtml(formatAge(patient))}</dd>
        <dt>Mobile</dt><dd>${escapeHtml(patient?.cp_number ?? '—')}</dd>
      </dl>

      <table>
        <thead>
          <tr><th>Item</th><th class="amount">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>${escapeHtml(order.description ?? 'Optical order')}</td><td class="amount">${formatPeso(order.total_amount)}</td></tr>
          ${payments
            .map(
              (payment) =>
                `<tr><td>${escapeHtml(describe(payment) || 'Payment')}</td><td class="amount">${formatPeso(payment.amount)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <div><span>Total</span><span>${formatPeso(order.total_amount)}</span></div>
        <div><span>Paid</span><span>${formatPeso(order.paid)}</span></div>
        <div class="grand"><span>Balance</span><span>${formatPeso(order.balance)}</span></div>
      </div>

      <div class="foot">
        Thank you for trusting us with your vision.<br />
        Please keep this receipt for your records.
      </div>
    </div>
  </body>
</html>`
}

/**
 * Opens a print-ready receipt in a new window. Returns false when the browser
 * blocks the popup so the caller can surface a message instead of failing
 * silently.
 */
export function printOrderReceipt(order, patient) {
  if (!order) return false
  const win = window.open('', '_blank', 'width=460,height=720')
  if (!win) return false
  win.document.open()
  win.document.write(receiptHtml(order, patient))
  win.document.close()
  win.focus()
  win.print()
  return true
}
