import { readFileSync } from 'fs'

const lines = readFileSync('src/pages/today.jsx', 'utf8').split('\n')

const keywords = [
  ['FollowupRow component def', 'function FollowupRow('],
  ['ChevronDown import', 'ChevronDown'],
  ['ChevronUp import', 'ChevronUp'],
  ['PhoneCall import', 'PhoneCall'],
  ['xl:col-span-2', 'xl:col-span-2'],
  ['follow-up-queue id', 'follow-up-queue'],
  ['Sales link today', 'sales-expenses?range=today'],
  ['Expenses tab URL', 'tab=expenses'],
  ['Summary tab URL', 'tab=summary'],
  ['Unpaid balances link', 'payment=OUTSTANDING'],
  ['Pickups link', 'status=READY_FOR_PICKUP'],
  ['Pagination stopProp', 'e.stopPropagation'],
  ['Select chevron class', 'select-chevron'],
  ['aria-live', 'aria-live'],
  ['aria-busy', 'aria-busy'],
  ['focus-within pickup', 'focus-within'],
  ['ArrowUpRight in collection', 'group-hover:opacity-100'],
  ['scroll-mt-20', 'scroll-mt-20'],
]

let ok = true
for (const [label, kw] of keywords) {
  const found = lines.some(l => l.includes(kw))
  if (!found) ok = false
  console.log(found ? '✓' : '✗ MISSING', label)
}

console.log('\nTotal lines:', lines.length)
if (ok) console.log('\nAll checks passed!')
else console.log('\nSome checks FAILED!')
