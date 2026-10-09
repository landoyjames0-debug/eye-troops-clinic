import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const QUERY_CACHE_PREFIX = 'eye-troops:query-cache:'
export const QUERY_ROOT = 'eye-troops'
export const QUERY_GC_TIME = 30 * 60 * 1000
export const QUERY_STALE_TIME = 60 * 1000
export const SUMMARY_STALE_TIME = 5 * 60 * 1000
export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: QUERY_GC_TIME,
      refetchOnWindowFocus: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 30_000),
    },
  },
})

export function clinicQueryKey(userId, name, ...params) {
  return [QUERY_ROOT, userId ?? 'signed-out', name, ...params]
}

export function createUserQueryPersister(userId) {
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: `${QUERY_CACHE_PREFIX}${userId}`,
    throttleTime: 1000,
  })
}

export function clearQueryCaches() {
  queryClient.clear()
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(QUERY_CACHE_PREFIX)) window.localStorage.removeItem(key)
    }
  } catch {
    // The in-memory cache is still cleared when storage is unavailable.
  }
}

export function invalidateClinicQueries(userId, ...names) {
  for (const name of names) {
    void queryClient.invalidateQueries({
      queryKey: [QUERY_ROOT, userId ?? 'signed-out', name],
    })
  }
}

export async function runTimedQuery(name, queryFn, signal) {
  const startedAt = performance.now()
  try {
    return await queryFn(signal)
  } finally {
    if (import.meta.env.DEV) {
      console.debug(`[query:${name}] ${Math.round(performance.now() - startedAt)}ms`)
    }
  }
}