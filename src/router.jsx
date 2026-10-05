import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { ErrorBoundary } from '@/components/error-boundary'
import { AppShell } from '@/layouts/app-shell'
import { useAuth } from '@/hooks/use-auth'

const LoginPage = lazy(() => import('@/pages/login'))
const SignUpPage = lazy(() => import('@/pages/signup'))
const TodayPage = lazy(() => import('@/pages/today'))
const PatientsPage = lazy(() => import('@/pages/patients'))
const AppointmentsPage = lazy(() => import('@/pages/appointments'))
const NewVisitPage = lazy(() => import('@/pages/new-visit'))
const OrdersPage = lazy(() => import('@/pages/orders'))
const SalesExpensesPage = lazy(() => import('@/pages/sales-expenses'))
const ProfilePage = lazy(() => import('@/pages/profile'))
const NotFoundPage = lazy(() => import('@/pages/not-found'))

function usePageTitle(title) {
  return () => {
    document.title = title
    return undefined
  }
}

function LazyPage({ Component, title }) {
  const PageTitle = usePageTitle(title)

  return (
    <Suspense
      fallback={
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex items-center gap-3 rounded-control border border-champagne bg-surface px-4 py-3 shadow-card">
            <div className="h-4 w-4 animate-pulse rounded-full bg-champagne/80" aria-hidden="true" />
            <p className="text-sm text-warmgray">Loading page…</p>
          </div>
        </div>
      }
    >
      <ErrorBoundary>
        <PageTitle />
        <Component />
      </ErrorBoundary>
    </Suspense>
  )
}

/** Blocks the shell until we know whether a session exists. */
function SessionGate({ children }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ivory px-6">
        <div className="flex items-center gap-3 rounded-control border border-champagne bg-surface px-4 py-3 shadow-card">
          <div className="h-4 w-4 animate-pulse rounded-full bg-champagne/80" aria-hidden="true" />
          <p className="text-sm text-warmgray">Loading application…</p>
        </div>
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
        <Route path="/login" element={<RedirectIfSignedIn><LazyPage Component={LoginPage} title="Login | Eye Troops" /></RedirectIfSignedIn>} />
        <Route path="/signup" element={<LazyPage Component={SignUpPage} title="Sign up | Eye Troops" />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/today" element={<LazyPage Component={TodayPage} title="Today | Eye Troops" />} />
          <Route path="/patients" element={<LazyPage Component={PatientsPage} title="Patients | Eye Troops" />} />
          <Route path="/appointments" element={<LazyPage Component={AppointmentsPage} title="Appointments | Eye Troops" />} />
          <Route path="/new-visit" element={<LazyPage Component={NewVisitPage} title="New Visit | Eye Troops" />} />
          <Route path="/orders" element={<LazyPage Component={OrdersPage} title="Orders & Balances | Eye Troops" />} />
          <Route path="/sales-expenses" element={<LazyPage Component={SalesExpensesPage} title="Sales & Expenses | Eye Troops" />} />
          <Route path="/profile" element={<LazyPage Component={ProfilePage} title="Profile & Settings | Eye Troops" />} />
        </Route>

        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<LazyPage Component={NotFoundPage} title="Page not found | Eye Troops" />} />
      </Routes>
    </SessionGate>
  )
}
