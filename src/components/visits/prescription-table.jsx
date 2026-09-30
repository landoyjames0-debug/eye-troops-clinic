import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'

function value(cell) {
  return cell && cell.trim() ? cell.trim() : '—'
}

const EYES = [
  { label: 'OD', key: 'od', hint: 'Right eye' },
  { label: 'OS', key: 'os', hint: 'Left eye' },
]

function pick(row, eye, field) {
  return row[`${eye}_${field}`] ?? null
}

/**
 * The standard OD/OS table used on both New Visit and patient details so the
 * two are always read the same way. Optical staff scan down the eye column and
 * across the sphere/cylinder/axis groups, so the headers stay abbreviated and
 * the figures stay tabular.
 */
export function PrescriptionTable({ prescription, compact = false }) {
  if (!prescription) {
    return <p className="px-4 py-4 text-[13px] text-warmgray">No prescription recorded.</p>
  }

  const fields = compact
    ? [
        { label: 'SPH', key: 'sph' },
        { label: 'CYL', key: 'cyl' },
        { label: 'AXIS', key: 'axis' },
        { label: 'ADD', key: 'add' },
      ]
    : [
        { label: 'SPH', key: 'sph' },
        { label: 'CYL', key: 'cyl' },
        { label: 'AXIS', key: 'axis' },
        { label: 'ADD', key: 'add' },
        { label: 'PD', key: 'pd' },
      ]

  return (
    <Table>
      <THead>
        <tr>
          <TH className="w-16">Eye</TH>
          {fields.map((field) => (
            <TH key={field.key} className="tabular text-right">
              {field.label}
            </TH>
          ))}
        </tr>
      </THead>
      <TBody>
        {EYES.map(({ label, key, hint }) => (
          <TR key={key} className="hover:bg-transparent">
            <TD>
              <span className="font-display text-[13px] font-bold tracking-wide text-gold-dark">
                {label}
              </span>
              <span className="sr-only">{hint}</span>
            </TD>
            {fields.map((field) => {
              const cell = value(pick(prescription, key, field.key))
              return (
                <TD
                  key={field.key}
                  className={
                    cell === '—'
                      ? 'tabular text-right text-champagne'
                      : 'tabular text-right text-[13px] font-medium text-espresso'
                  }
                >
                  {cell}
                </TD>
              )
            })}
          </TR>
        ))}
      </TBody>
    </Table>
  )
}
