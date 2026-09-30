import { IS_SUPABASE_CONFIGURED } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toAmount, toDateKey } from '@/utils/dates'

export async function createExpense(input) {
  const amount = toAmount(input.amount)
  if (!(amount > 0)) {
    throw toAppError(new Error('amount must be positive'), 'saveExpense')
  }

  const payload = {
    expense_date: input.expense_date,
    category: input.category,
    amount,
    description: input.description.trim() || null,
  }

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_EXPENSES } = await import('@/lib/demo-data')
    const expense = {
      id: `exp-${DEMO_EXPENSES.length + 1}`,
      ...payload,
      created_by: null,
      created_at: new Date().toISOString(),
    }
    DEMO_EXPENSES.unshift(expense)
    return expense
  }

  try {
    return unwrap(await supabase.from('expenses').insert(payload).select('*').single())
  } catch (caught) {
    throw toAppError(caught, 'saveExpense')
  }
}

export async function listExpenses(from, to) {
  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_EXPENSES } = await import('@/lib/demo-data')
    return DEMO_EXPENSES.filter(
      (expense) =>
        (!from || expense.expense_date >= from) && (!to || expense.expense_date <= to),
    ).sort((a, b) => Date.parse(b.expense_date) - Date.parse(a.expense_date))
  }

  try {
    let query = supabase.from('expenses').select('*')
    if (from) query = query.gte('expense_date', from)
    if (to) query = query.lte('expense_date', to)
    return unwrap(await query.order('expense_date', { ascending: false }))
  } catch (caught) {
    throw toAppError(caught, 'loadExpenses')
  }
}

export function totalExpenses(rows) {
  return toAmount(rows.reduce((sum, row) => sum + Number(row.amount), 0))
}

export function todayKey() {
  return toDateKey()
}

/** Editing a mistaken entry — category, amount, date or description. */
export async function updateExpense(expenseId, input) {
  const amount = toAmount(input.amount)
  if (!(amount > 0)) {
    throw toAppError(new Error('amount must be positive'), 'saveExpense')
  }

  const payload = {
    expense_date: input.expense_date,
    category: input.category,
    amount,
    description: input.description.trim() || null,
  }

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_EXPENSES } = await import('@/lib/demo-data')
    const expense = DEMO_EXPENSES.find((row) => row.id === expenseId)
    if (!expense) throw toAppError(new Error('not found'), 'notFound')
    Object.assign(expense, payload, { updated_at: new Date().toISOString() })
    return expense
  }

  try {
    return unwrap(
      await supabase.from('expenses').update(payload).eq('id', expenseId).select('*').single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'updateExpense')
  }
}

export async function deleteExpense(expenseId) {
  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_EXPENSES } = await import('@/lib/demo-data')
    const index = DEMO_EXPENSES.findIndex((row) => row.id === expenseId)
    if (index === -1) throw toAppError(new Error('not found'), 'notFound')
    const [removed] = DEMO_EXPENSES.splice(index, 1)
    return removed
  }

  try {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) throw error
    return { id: expenseId }
  } catch (caught) {
    throw toAppError(caught, 'deleteExpense')
  }
}
