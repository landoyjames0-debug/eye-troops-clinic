import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { APP_NAME, APP_SUBTITLE, LOGO_PATH } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/hooks/use-auth'

const NAV_ITEMS = [
  { to: '/today', label: 'Today', short: 'Today', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', short: 'Patients', icon: Users },
  { to: '/new-visit', label: 'New Visit', short: 'New Visit', icon: PlusCircle },
  { to: '/orders', label: 'Orders & Balances', short: 'Orders', icon: ClipboardList },
  { to: '/sales-expenses', label: 'Sales & Expenses', short: 'Sales', icon: Wallet },
]

/**
 * Official artwork. The source is a square PNG, so `object-contain` in a square
 * box keeps it sharp and never stretched.
 */
export function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={LOGO_PATH}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-lg object-contain"
      />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-extrabold tracking-tight text-espresso">
            {APP_NAME}
          </span>
          <span className="block text-[9px] font-semibold tracking-[0.18em] text-gold">
            {APP_SUBTITLE}
          </span>
        </span>
      )}
    </div>
  )
}

function NavItem({ to, label, icon: Icon, className, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium',
          'transition-colors duration-150',
          isActive
            ? 'bg-gold-light/70 font-semibold text-espresso'
            : 'font-medium text-warmgray hover:bg-ivory hover:text-espresso',
          className,
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold transition-opacity duration-150',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />
          <Icon
            className={cn(
              'size-[19px] shrink-0',
              isActive ? 'text-gold-dark' : 'text-warmgray',
            )}
            strokeWidth={1.7}
            aria-hidden="true"
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const { profile, isDemo, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = isDemo ? 'Demo session' : (profile?.full_name ?? 'Signed in')
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      setConfirmSignOut(false)
      navigate('/login', { replace: true, state: { signedOut: true } })
    } catch {
      toast.error('Could not sign out', { description: 'Please try again.' })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-dvh bg-ivory lg:flex">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-champagne bg-surface lg:flex">
        <div className="px-6 py-5">
          <BrandMark />
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 px-4 py-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-champagne p-4">
          <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-1 py-1">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-light text-[11px] font-semibold text-gold-dark"
              aria-hidden="true"
            >
              {displayName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('')}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-espresso">
                {displayName}
              </span>
              <span className="block text-[11px] text-warmgray">
                {isDemo ? 'Sample data' : 'Signed in'}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setConfirmSignOut(true)}
            className="mt-1.5 flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
          >
            <LogOut className="size-[17px]" strokeWidth={1.7} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Header — mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-champagne bg-surface/90 px-4 py-3 backdrop-blur-sm lg:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className="rounded-[var(--radius-control)] p-2 text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
          aria-label="Sign out"
        >
          <LogOut className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>

      {/* Bottom tab bar — mobile. Five destinations fit without scrolling, so
          the primary navigation never hides off-screen. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-champagne bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
      >
        {NAV_ITEMS.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-gold-dark' : 'text-warmgray',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-gold transition-opacity duration-150',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                <span className={isActive ? 'font-semibold' : undefined}>{short}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <ConfirmDialog
        open={confirmSignOut}
        title="Sign out?"
        message={
          isDemo
            ? 'You will leave the demo session and return to the login screen. Unsaved work in open forms may be lost.'
            : 'You will need to sign in again to access the clinic dashboard.'
        }
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        tone="neutral"
        loading={signingOut}
        loadingText="Signing out..."
        onConfirm={handleSignOut}
        onClose={() => {
          if (!signingOut) setConfirmSignOut(false)
        }}
      />

      <main className="min-w-0 flex-1">
        {/* `pb-24` clears the fixed mobile tab bar. */}
        <div className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
