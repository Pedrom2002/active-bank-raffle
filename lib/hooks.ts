'use client'

import { useEffect, useRef } from 'react'

export function usePolling(fn: () => void, intervalMs: number) {
  // Stable ref so the interval always calls the latest version of fn
  // without needing to be recreated when fn changes identity.
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn }, [fn])

  useEffect(() => {
    fnRef.current()
    const iv = setInterval(() => fnRef.current(), intervalMs)
    return () => clearInterval(iv)
  }, [intervalMs])
}
