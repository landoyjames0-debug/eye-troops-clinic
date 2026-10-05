import { queryClient, clinicQueryKey, runTimedQuery, QUERY_STALE_TIME, SUMMARY_STALE_TIME } from './query-client'
import { getDashboardSummary, getPickupsDue, getTodayActivity, getMonthlySeries } from '@/services/dashboard.service'
import { listPatients, listPatientRoster } from '@/services/patients.service'
import { listOrders } from '@/services/orders.service'
import { listAppointments } from '@/lib/appointments'
import { listPayments, collectionsByMethod } from '@/services/payments.service'
import { listExpenses } from '@/services/expenses.service'
import { listFollowups, getFollowupCounts } from '@/lib/followups'
import { monthBounds, toDateKey } from '@/utils/dates'

let prefetchTimer = null

/**
 * Prefetches the essential queries for a destination page with a 100ms debounce
 * so rapid pointer movements do not fire wasteful requests.
 */
export function prefetchRouteWithDebounce(to, userId, debounceMs = 100) {
  if (prefetchTimer) {
    clearTimeout(prefetchTimer)
    prefetchTimer = null
  }

  prefetchTimer = setTimeout(() => {
    executePrefetch(to, userId)
  }, debounceMs)
}

export function cancelRoutePrefetch() {
  if (prefetchTimer) {
    clearTimeout(prefetchTimer)
    prefetchTimer = null
  }
}

function executePrefetch(to, userId) {
  const path = to.split('?')[0].split('#')[0]
  const today = toDateKey()
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const mBounds = monthBounds(currentYear, currentMonth)

  switch (path) {
    case '/today':
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadSummary', 'dashboard-summary'),
        queryFn: () => runTimedQuery('dashboard-summary', getDashboardSummary),
        staleTime: SUMMARY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadSummary', 'today-activity'),
        queryFn: () => runTimedQuery('today-activity', () => getTodayActivity()),
        staleTime: QUERY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadOrders', 'today-pickups'),
        queryFn: () => runTimedQuery('today-pickups', () => getPickupsDue()),
        staleTime: QUERY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadPayments', 'today-collections'),
        queryFn: () => runTimedQuery('today-collections', () => collectionsByMethod()),
        staleTime: QUERY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadFollowups', 'today-followups', 'all', false),
        queryFn: () => runTimedQuery('today-followups', async () => {
          const [items, counts] = await Promise.all([
            listFollowups({ filter: 'all', limit: 5 }),
            getFollowupCounts(),
          ])
          return { items, counts }
        }),
        staleTime: QUERY_STALE_TIME,
      })
      break

    case '/patients':
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadPatients', 'patient-roster', ''),
        queryFn: () => runTimedQuery('patient-roster', () => listPatients('')),
        staleTime: QUERY_STALE_TIME,
      })
      break

    case '/orders':
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadOrders', 'orders-list', ''),
        queryFn: () => runTimedQuery('orders-list', () => listOrders('', 'ALL', 'ALL')),
        staleTime: QUERY_STALE_TIME,
      })
      break

    case '/appointments':
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadAppointments', 'appointments-upcoming', todayStart),
        queryFn: () => runTimedQuery('appointments-upcoming', () => listAppointments({ from: todayStart })),
        staleTime: QUERY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadPatients', 'patient-roster'),
        queryFn: () => runTimedQuery('patient-roster', () => listPatientRoster()),
        staleTime: SUMMARY_STALE_TIME,
      })
      break

    case '/sales-expenses':
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadSummary', 'finance-monthly-series', currentYear),
        queryFn: () => runTimedQuery('finance-monthly-series', () => getMonthlySeries(currentYear)),
        staleTime: SUMMARY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadPayments', 'finance-payments', mBounds.from, mBounds.to),
        queryFn: () => runTimedQuery('finance-payments', () => listPayments(mBounds.from, mBounds.to)),
        staleTime: QUERY_STALE_TIME,
      })
      void queryClient.prefetchQuery({
        queryKey: clinicQueryKey(userId, 'loadExpenses', 'finance-expenses', mBounds.from, mBounds.to),
        queryFn: () => runTimedQuery('finance-expenses', () => listExpenses(mBounds.from, mBounds.to)),
        staleTime: QUERY_STALE_TIME,
      })
      break

    default:
      break
  }
}
