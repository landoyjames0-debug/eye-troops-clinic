import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  Pin,
  PinOff,
  PlusCircle,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { APP_NAME, APP_SUBTITLE, LOGO_PATH } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useAuth } from '@/hooks/use-auth'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSidebar } from '@/hooks/use-sidebar'
import { useTheme } from '@/hooks/use-theme'
import { prefetchRouteWithDebounce, cancelRoutePrefetch } from '@/lib/prefetch'

const NAV_ITEMS = [
  { to: '/today', label: 'Today', short: 'Today', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', short: 'Patients', icon: Users },
  { to: '/appointments', label: 'Appointments', short: 'Appts', icon: CalendarRange },
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
    <div className="flex items-center gap-2.5 min-w-0">
      <img
        src={LOGO_PATH}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-lg object-contain"
      />
      <span className="sidebar-brand-text leading-tight" aria-hidden={compact}>
        <span className="block font-display text-[15px] font-extrabold tracking-tight text-espresso whitespace-nowrap">
          {APP_NAME}
        </span>
        <span className="block text-[9px] font-semibold tracking-[0.18em] text-gold whitespace-nowrap">
          {APP_SUBTITLE}
        </span>
      </span>
    </div>
  )
}

function NavItem({ to, label, icon: Icon, expanded, onNavigate, userId }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRouteWithDebounce(to, userId, 100)}
      onMouseLeave={cancelRoutePrefetch}
      onFocus={() => prefetchRouteWithDebounce(to, userId, 0)}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'sidebar-nav-item',
          isActive && 'sidebar-nav-item-active',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'sidebar-active-indicator',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden="true"
          />
          <span className="sidebar-icon-box" aria-hidden="true">
            <Icon
              className="sidebar-nav-icon"
              fill={isActive ? 'currentColor' : 'none'}
              fillOpacity={isActive ? 0.14 : 0}
              strokeWidth={isActive ? 2.1 : 1.7}
            />
          </span>
          <span className="sidebar-nav-label" aria-hidden={!expanded}>{label}</span>
          <span className="sidebar-tooltip" aria-hidden="true">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function QuickPatientSearch({ expanded, onNavigate }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    navigate(`/patients?search=${encodeURIComponent(trimmed)}`)
    onNavigate?.()
    setQuery('')
  }

  return (
    <form onSubmit={handleSubmit} className={cn('sidebar-search-wrap', expanded && 'sidebar-search-wrap-expanded')}>
      <label htmlFor="quick-patient-search" className="sr-only">
        Search patients
      </label>
      <div className="sidebar-search-input-shell">
        <Search className="sidebar-search-icon" aria-hidden="true" />
        <input
          id="quick-patient-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={expanded ? 'Find patient' : ''}
          aria-label="Find patient"
          className="sidebar-search-input"
        />
      </div>
    </form>
  )
}

export function AppShell() {
  const { profile, signOut, userId } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const {
    expanded,
    pinned,
    handlePointerEnter,
    handlePointerLeave,
    handleFocus,
    handleBlur,
    toggle,
    togglePin,
    close,
  } = useSidebar()
  const sidebarRef = useRef(null)
  const displayName = profile?.full_name ?? 'Signed in'
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  useEffect(() => {
    if (!expanded) return undefined

    const handlePointerDown = (event) => {
      if (sidebarRef.current?.contains(event.target)) return
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches
      if (pinned && isDesktop) return
      close(false)
    }
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches
      if (pinned && isDesktop) return
      close(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, expanded, pinned])

  const handleNavigate = () => {
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (!isDesktop) close(true)
  }

  const handleSignOut = () => {
    void confirm({
      title: 'Sign out?',
      message: 'You will need to sign in again to access the clinic dashboard.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in',
      variant: 'default',
      onConfirm: async () => {
        try {
          await signOut()
          navigate('/login', { replace: true })
          resultDialog.success({
            title: 'Signed out',
            message: 'You have been signed out successfully.',
            primaryLabel: 'Continue',
            autoCloseMs: 5000,
          })
        } catch (caught) {
          resultDialog.error({
            title: 'Could not sign out',
            message: 'Please check your connection and try again.',
            details: caught?.message,
            retryLabel: 'Try again',
            onRetry: async () => {
              await signOut()
              navigate('/login', { replace: true })
              resultDialog.success({ title: 'Signed out', message: 'You have been signed out successfully.' })
            },
          })
        }
      },
      errorMessage: 'Could not sign out. Please try again.',
    })
  }

  return (
    <div className="app-shell-root min-h-dvh bg-ivory">
      {/* Mobile drawer backdrop */}
      {expanded && !pinned && (
        <div
          className="sidebar-backdrop md:hidden fixed inset-0 z-45 bg-espresso/40 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => close(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        id="app-sidebar"
        aria-label="Application sidebar"
        aria-expanded={expanded}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          'sidebar-rail',
          expanded && 'sidebar-rail-expanded',
          pinned && 'sidebar-rail-pinned',
          !pinned && expanded && 'sidebar-rail-overlay',
        )}
      >
        <div className="sidebar-brand-row">
          <button
            type="button"
            className="sidebar-brand-toggle"
            onClick={toggle}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={expanded}
            aria-controls="sidebar-primary-navigation"
          >
            <BrandMark compact={!expanded} />
          </button>
          <button
            type="button"
            className="sidebar-pin-toggle"
            onClick={togglePin}
            aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
            aria-pressed={pinned}
            title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          >
            {pinned ? <PinOff className="size-4.5" aria-hidden="true" /> : <Pin className="size-4.5" aria-hidden="true" />}
          </button>
        </div>

        <QuickPatientSearch expanded={expanded} onNavigate={handleNavigate} />

        <nav id="sidebar-primary-navigation" aria-label="Primary navigation" className="sidebar-primary-navigation">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} expanded={expanded} onNavigate={handleNavigate} userId={userId} />
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            onClick={toggleTheme}
            className="sidebar-nav-item"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={!expanded ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : undefined}
          >
            <span className="sidebar-icon-box" aria-hidden="true">
              {theme === 'dark' ? (
                <Sun className="sidebar-nav-icon" strokeWidth={1.8} />
              ) : (
                <Moon className="sidebar-nav-icon" strokeWidth={1.8} />
              )}
            </span>
            <span className="sidebar-nav-label" aria-hidden={!expanded}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
            <span className="sidebar-tooltip" aria-hidden="true">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          <NavLink
            to="/profile"
            onClick={handleNavigate}
            onMouseEnter={() => prefetchRouteWithDebounce('/profile', userId, 100)}
            onMouseLeave={cancelRoutePrefetch}
            aria-label={`Profile and settings for ${displayName}`}
            className={({ isActive }) =>
              cn('sidebar-profile-link', isActive && 'sidebar-profile-link-active')
            }
            title={!expanded ? 'Profile & Settings' : undefined}
          >
            <span
              className="sidebar-profile-avatar"
              aria-hidden="true"
            >
              {initials}
            </span>
            <div className="sidebar-profile-copy" aria-hidden={!expanded}>
              <span className="sidebar-profile-name">{displayName}</span>
              <span className="sidebar-profile-caption">Profile &amp; Settings</span>
            </div>
            <Settings className="sidebar-profile-settings" aria-hidden="true" />
            <span className="sidebar-tooltip" aria-hidden="true">Profile &amp; Settings</span>
          </NavLink>

          <button
            type="button"
            onClick={handleSignOut}
            className="sidebar-signout"
            title={!expanded ? 'Sign out' : undefined}
            aria-label="Sign out"
          >
            <span className="sidebar-icon-box" aria-hidden="true">
              <LogOut className="sidebar-nav-icon" strokeWidth={1.7} />
            </span>
            <span className="sidebar-nav-label" aria-hidden={!expanded}>Sign out</span>
            <span className="sidebar-tooltip" aria-hidden="true">Sign out</span>
          </button>
        </div>
      </aside>

      <header className="mobile-app-header">
        <BrandMark />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NavLink
            to="/profile"
            aria-label="Profile and settings"
            className="rounded-control p-2 text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
          >
            <UserRound className="size-4.5" strokeWidth={1.7} aria-hidden="true" />
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-control p-2 text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
            aria-label="Sign out"
          >
            <LogOut className="size-4.5" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Bottom tab bar — mobile. Five destinations fit without scrolling, so
          the primary navigation never hides off-screen. */}
      <nav
        aria-label="Primary navigation"
        className="mobile-bottom-navigation"
      >
        {NAV_ITEMS.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            onClick={() => close(true)}
            to={to}
            className={({ isActive }) =>
              cn(
                'mobile-tab-link',
                isActive && 'mobile-tab-link-active',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'mobile-tab-indicator',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <Icon
                  className="size-5"
                  fill={isActive ? 'currentColor' : 'none'}
                  fillOpacity={isActive ? 0.14 : 0}
                  strokeWidth={isActive ? 2.1 : 1.8}
                  aria-hidden="true"
                />
                <span>{short}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <main className="app-shell-main min-w-0 flex-1" style={{ '--sidebar-main-offset': pinned ? '245px' : '72px' }}>
        {/* `pb-24` clears the fixed mobile tab bar. */}
        <div className="mx-auto w-full max-w-330 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
