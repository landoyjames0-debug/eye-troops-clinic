import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { ErrorBoundary } from '@/components/error-boundary'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { SplashScreen } from '@/components/splash-screen'
import { AppRouter } from '@/router'

export function App() {
  return (
    <ErrorBoundary>
      <SplashScreen>
        <BrowserRouter>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-200 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-espresso focus:shadow-pop focus:outline-solid focus:outline-2 focus:outline-offset-2 focus:outline-gold"
        >
          Skip to main content
        </a>
        <ConnectionBanner />
        <AppRouter />
        <PwaInstallPrompt />

        {/* Top-centre keeps toasts clear of both the sidebar and the mobile tab bar. */}
        <Toaster
          position="top-center"
          offset={16}
          duration={4000}
          toastOptions={{
            classNames: {
              toast:
                'rounded-[var(--radius-control)] border border-champagne bg-surface text-espresso shadow-pop',
              title: 'font-semibold text-espresso',
              description: 'text-warmgray',
              actionButton: 'rounded-md bg-gold-light text-gold-dark',
              cancelButton: 'rounded-md bg-ivory text-warmgray',
            },
          }}
        />
      </BrowserRouter>
    </SplashScreen>
  </ErrorBoundary>
  )
}
