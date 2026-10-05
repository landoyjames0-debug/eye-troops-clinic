import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './app'
import { AuthProvider } from './hooks/use-auth'
import { UserQueryPersistence } from './hooks/use-query-persistence'
import { ConfirmProvider } from './hooks/use-confirm'
import { ResultDialogProvider } from './hooks/use-result-dialog'
import { SupabaseHealthProvider } from './hooks/use-supabase-health'
import { ThemeProvider } from './hooks/use-theme'
import { queryClient } from './lib/query-client'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root was not found in index.html.')
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserQueryPersistence>
          <ThemeProvider>
            <ConfirmProvider>
              <ResultDialogProvider>
                <SupabaseHealthProvider>
                  <App />
                </SupabaseHealthProvider>
              </ResultDialogProvider>
            </ConfirmProvider>
          </ThemeProvider>
        </UserQueryPersistence>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
