import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toAmount, toDateKey } from '@/utils/dates'

const EXPORT_BATCH_SIZE = 1000

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

  try {
    return unwrap(await supabase.from('expenses').insert(payload).select('*').single())
  } catch (caught) {
    throw toAppError(caught, 'saveExpense')
  }
}

export async function listExpenses(from, to) {
  try {
    let query = supabase
      .from('expenses')
      .select('id, expense_date, category, amount, description, created_at')
    if (from) query = query.gte('expense_date', from)
    if (to) query = query.lte('expense_date', to)
    return unwrap(await query.order('expense_date', { ascending: false }))
  } catch (caught) {
    throw toAppError(caught, 'loadExpenses')
  }
}

export async function getEarliestExpenseDate() {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('expense_date')
      .order('expense_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.expense_date ?? null
  } catch (caught) {
    throw toAppError(caught, 'loadExpenses')
  }
}

export async function listAllExpenses(from, to) {
  try {
    const rows = []
    for (let offset = 0; ; offset += EXPORT_BATCH_SIZE) {
      let query = supabase.from('expenses').select('*')
      if (from) query = query.gte('expense_date', from)
      if (to) query = query.lte('expense_date', to)

      const batch = unwrap(
        await query
          .order('expense_date', { ascending: false })
          .range(offset, offset + EXPORT_BATCH_SIZE - 1),
      )
      rows.push(...batch)
      if (batch.length < EXPORT_BATCH_SIZE) return rows
    }
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

  try {
    return unwrap(
      await supabase.from('expenses').update(payload).eq('id', expenseId).select('*').single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'updateExpense')
  }
}

export async function deleteExpense(expenseId) {
  try {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
    if (error) throw error
    return { id: expenseId }
  } catch (caught) {
    throw toAppError(caught, 'deleteExpense')
  }
}
