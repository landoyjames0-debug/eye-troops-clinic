import { useCallback, useEffect, useRef, useState } from 'react'
import { toAppError } from '@/utils/errors'

/**
 * Runs an async loader and tracks loading/error state.
 *
 * `deps` behaves like a useEffect dependency list; changing them re-runs the
 * loader. Late responses from superseded requests are discarded so a slow
 * request cannot overwrite fresher data.
 */
export function useAsync(loader, deps, errorKey = 'load') {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  })
  const [nonce, setNonce] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    let active = true

    setState((prev) => ({ ...prev, loading: true, error: null }))

    loaderRef
      .current()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((caught) => {
        if (!active) return
        const appError = toAppError(caught, errorKey)
        setState({ data: null, loading: false, error: appError.message })
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, errorKey])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { ...state, reload }
}
