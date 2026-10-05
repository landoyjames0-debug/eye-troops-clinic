import { useCallback } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useDelayedLoading } from '@/hooks/use-delayed-loading'
import {
  QUERY_GC_TIME,
  QUERY_STALE_TIME,
  SUMMARY_STALE_TIME,
  clinicQueryKey,
  runTimedQuery,
} from '@/lib/query-client'
import { toAppError } from '@/utils/errors'

/**
 * Returns true only for errors worth retrying (network, timeout, 5xx).
 * PostgREST 4xx errors (e.g. 42P01 missing relation, 403 RLS denied)
 * are not retried — the schema won't fix itself between attempts.
 */
function shouldRetry(failureCount, error) {
  if (failureCount >= 2) return false

  // SupabaseRequestError set .kind directly
  const kind = error?.kind
  if (kind === 'network' || kind === 'timeout' || kind === 'server') return true

  // HTTP status on the error object (set by unwrap / Supabase SDK)
  const status = Number(error?.status ?? error?.statusCode ?? 0)
  if (status >= 500 && status <= 599) return true

  // PostgREST errors carry a PostgreSQL error code string (e.g. '42P01').
  // Any error with a .code field is a DB-level error — don't retry.
  if (error?.code) return false

  // Plain network failures (TypeError: Failed to fetch, etc.)
  const msg = String(error?.message ?? '')
  if (/failed to fetch|fetch failed|network request failed|networkerror/i.test(msg)) return true

  return false
}

/**
 * Runs an async loader and tracks loading/error state.
 *
 * `deps` behaves like a useEffect dependency list; changing them re-runs the
 * loader. Late responses from superseded requests are discarded so a slow
 * request cannot overwrite fresher data.
 */
export function useAsync(loader, deps, errorKey = 'load', options = {}) {
  const { userId } = useAuth()
  const queryName = options.name ?? options.key ?? errorKey
  const sourceKey = options.key ?? loader.toString()
  const query = useQuery({
    queryKey: clinicQueryKey(userId, errorKey, sourceKey, ...deps),
    queryFn: ({ signal }) => runTimedQuery(queryName, loader, signal),
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? (errorKey === 'loadSummary' ? SUMMARY_STALE_TIME : QUERY_STALE_TIME),
    gcTime: QUERY_GC_TIME,
    refetchOnWindowFocus: true,
    retry: shouldRetry,
    retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 30_000),
    placeholderData: keepPreviousData,
    meta: { persist: options.persist === true, queryName },
  })
  const delayedInitial = useDelayedLoading(query.isPending && query.data === undefined)
  const delayedRefetch = useDelayedLoading(query.isFetching && query.data !== undefined, {
    delay: 1000,
    minVisible: 0,
    slowAfter: Number.MAX_SAFE_INTEGER,
  })
  const error = query.error
    ? toAppError(query.error, errorKey).message
    : null
  const refetch = query.refetch
  const reload = useCallback(() => refetch(), [refetch])

  return {
    data: query.data ?? null,
    error,
    loading: query.isPending,
    showSkeleton: delayedInitial.visible,
    slow: delayedInitial.slow,
    isFetching: query.isFetching,
    refetchingSlow: delayedRefetch.visible,
    reload,
  }
}
