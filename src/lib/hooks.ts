import { useEffect, useState } from 'react'

/** État mémorisé dans le navigateur (préférences d'affichage : tri, vue, favoris…). */
export function useLocalState<T>(key: string, initial: () => T, migrate?: (v: T) => T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as T
        return migrate ? migrate(parsed) : parsed
      }
    } catch {
      /* stockage indisponible */
    }
    return initial()
  })
  const set = (nv: T) => {
    setV(nv)
    try {
      localStorage.setItem(key, JSON.stringify(nv))
    } catch {
      /* stockage indisponible */
    }
  }
  return [v, set]
}

export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export const useWide = () => useMedia('(min-width: 1024px)')
