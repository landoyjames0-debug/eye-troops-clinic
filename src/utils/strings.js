export function statusLabel(status) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function initials(name) {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '—'
}

/** "OD -1.25 / OS -1.50" — the compact form used in the patient table. */
export function summarisePrescription(row) {
  const od = row.od_sph ? `OD ${row.od_sph}` : 'OD —'
  const os = row.os_sph ? `OS ${row.os_sph}` : 'OS —'
  return `${od} / ${os}`
}

export function joinAddress(address) {
  return address && address.trim() ? address.trim() : ''
}
