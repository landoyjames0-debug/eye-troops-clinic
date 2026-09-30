import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AppShell } from '@/layouts/app-shell'
import { useAuth } from '@/hooks/use-auth'
import LoginPage from '@/pages/login'
import TodayPage from '@/pages/today'
import PatientsPage from '@/pages/patients'
import NewVisitPage from '@/pages/new-visit'
import OrdersPage from '@/pages/orders'
import SalesExpensesPage from '@/pages/sales-expenses'

/** Blocks the shell until we know whether a session exists. */
function SessionGate({ children }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ivory">
        <p className="text-sm text-warmgray">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}

function RequireAuth({ children }) {
  const { userId } = useAuth()
  const location = useLocation()

  if (!userId) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

/** Keeps signed-in staff off the login screen. */
function RedirectIfSignedIn({ children }) {
  const { userId, loading } = useAuth()
  if (loading) return null
  if (userId) return <Navigate to="/today" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <SessionGate>
      <Routes>
        <Route path="/login" element={<RedirectIfSignedIn><LoginPage /></RedirectIfSignedIn>} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/today" element={<TodayPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/new-visit" element={<NewVisitPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/sales-expenses" element={<SalesExpensesPage />} />
        </Route>

        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </SessionGate>
  )
}
