import { useMemo } from 'react'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { useAuth } from '@/hooks/use-auth'
import {
  QUERY_CACHE_MAX_AGE,
  createUserQueryPersister,
  queryClient,
} from '@/lib/query-client'

export function UserQueryPersistence({ children }) {
  const { userId } = useAuth()
  const persister = useMemo(
    () => userId ? createUserQueryPersister(userId) : null,
    [userId],
  )

  if (!userId || !persister) return children

  return (
    <PersistQueryClientProvider
      key={userId}
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE,
        buster: 'eye-troops-cache-v1',
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && query.meta?.persist === true,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}