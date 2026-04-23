import { useEffect, useRef } from 'react'

/**
 * Calls `fn` whenever the browser tab regains visibility or the window receives focus.
 * Useful for refreshing stale data without requiring a page reload.
 */
export function useRefreshOnFocus(fn: () => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const handle = () => {
      if (!document.hidden) fnRef.current()
    }
    document.addEventListener('visibilitychange', handle)
    window.addEventListener('focus', handle)
    return () => {
      document.removeEventListener('visibilitychange', handle)
      window.removeEventListener('focus', handle)
    }
  }, [])
}
