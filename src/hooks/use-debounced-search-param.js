import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const SEARCH_DEBOUNCE_MS = 300

export function useDebouncedSearchParam() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchFromUrl = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(searchFromUrl)
  const [deferredSearch, setDeferredSearch] = useState(searchFromUrl)
  const lastSearchFromUrl = useRef(searchFromUrl)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDeferredSearch(search), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (searchFromUrl !== lastSearchFromUrl.current) {
      lastSearchFromUrl.current = searchFromUrl
      setSearch(searchFromUrl)
      setDeferredSearch(searchFromUrl)
      return
    }

    const trimmed = deferredSearch.trim()
    if (trimmed === searchFromUrl) return

    const next = new URLSearchParams(searchParams)
    if (trimmed) next.set('search', trimmed)
    else next.delete('search')
    lastSearchFromUrl.current = trimmed
    setSearchParams(next, { replace: true })
  }, [deferredSearch, searchFromUrl, searchParams, setSearchParams])

  return {
    search,
    setSearch,
    deferredSearch,
    searchPending: search.trim() !== deferredSearch.trim(),
  }
}