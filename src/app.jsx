import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/use-auth'
import { AppRouter } from '@/router'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>

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
  )
}
