import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { AppShell } from '@/layouts/app-shell'
import { useAuth } from '@/hooks/use-auth'

const LoginPage = lazy(() => import('@/pages/login'))
const TodayPage = lazy(() => import('@/pages/today'))
const PatientsPage = lazy(() => import('@/pages/patients'))
const NewVisitPage = lazy(() => import('@/pages/new-visit'))
const OrdersPage = lazy(() => import('@/pages/orders'))
const SalesExpensesPage = lazy(() => import('@/pages/sales-expenses'))

function LazyPage({ Component }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-64 items-center justify-center">
          <p className="text-sm text-warmgray">Loading page…</p>
        </div>
      }
    >
      <Component />
    </Suspense>
  )
}

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
        <Route path="/login" element={<RedirectIfSignedIn><LazyPage Component={LoginPage} /></RedirectIfSignedIn>} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/today" element={<LazyPage Component={TodayPage} />} />
          <Route path="/patients" element={<LazyPage Component={PatientsPage} />} />
          <Route path="/new-visit" element={<LazyPage Component={NewVisitPage} />} />
          <Route path="/orders" element={<LazyPage Component={OrdersPage} />} />
          <Route path="/sales-expenses" element={<LazyPage Component={SalesExpensesPage} />} />
        </Route>

        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </SessionGate>
  )
}
