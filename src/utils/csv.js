function escapeCsvValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''

  let text = value == null ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replaceAll('"', '""')}"`
  return text
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',')
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = row[column.key]
        const formatted = typeof column.format === 'function'
          ? column.format(value, row)
          : value
        return escapeCsvValue(formatted)
      })
      .join(','),
  )

  return `\uFEFF${[header, ...body].join('\r\n')}`
}

export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}