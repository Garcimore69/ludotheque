import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './data'
import { compressImage } from './image'
import { supabase } from './supabase'
import type { Copy, CopyInput, Game, GameInput, Item } from './types'

interface Store {
  session: Session | null
  authReady: boolean
  loading: boolean
  ready: boolean // collection chargée au moins une fois (cache ou serveur)
  error: string | null
  games: Map<string, Game>
  copies: Copy[]
  items: Item[]
  photoUrl: (path: string | null) => string | null
  reload: () => Promise<void>
  createGameWithCopy: (g: GameInput, c: CopyInput) => Promise<{ game: Game; copy: Copy }>
  saveGame: (id: string, patch: Partial<Game>) => Promise<Game>
  removeGame: (id: string) => Promise<void>
  addCopy: (c: CopyInput & { game_id: string }) => Promise<Copy>
  saveCopy: (id: string, patch: Partial<Copy>) => Promise<Copy>
  removeCopy: (id: string) => Promise<void>
  setPhoto: (copy: Copy, file: File) => Promise<void>
  clearPhoto: (copy: Copy) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

const cacheKey = (uid: string) => `ludo-cache-${uid}`

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [games, setGames] = useState<Map<string, Game>>(new Map())
  const [copies, setCopies] = useState<Copy[]>([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const signing = useRef(new Set<string>())
  const pending = useRef(new Set<string>())
  const scheduled = useRef(false)

  // ---- Session
  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id ?? null

  const apply = useCallback((g: Game[], c: Copy[]) => {
    setGames(new Map(g.map((x) => [x.id, x])))
    setCopies(c)
  }, [])

  // Copie locale : la collection s'affiche instantanément, puis se met à jour.
  const persist = useCallback(
    (g: Map<string, Game>, c: Copy[]) => {
      if (!uid) return
      try {
        localStorage.setItem(cacheKey(uid), JSON.stringify({ games: [...g.values()], copies: c }))
      } catch {
        /* quota plein ou stockage bloqué : sans gravité */
      }
    },
    [uid],
  )

  const reload = useCallback(async () => {
    if (!uid) return
    setLoading(true)
    setError(null)
    try {
      const { games: g, copies: c } = await api.loadCollection()
      apply(g, c)
      setReady(true)
      persist(new Map(g.map((x) => [x.id, x])), c)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [uid, apply, persist])

  useEffect(() => {
    if (!uid) {
      apply([], [])
      setReady(false)
      return
    }
    try {
      const raw = localStorage.getItem(cacheKey(uid))
      if (raw) {
        const { games: g, copies: c } = JSON.parse(raw)
        apply(g, c)
        setReady(true)
      }
    } catch {
      /* cache illisible : on attend le serveur */
    }
    reload()
  }, [uid, apply, reload])

  // Garde la copie locale à jour après chaque modification
  useEffect(() => {
    if (uid && (games.size || copies.length)) persist(games, copies)
  }, [uid, games, copies, persist])

  // ---- Photos : URL signées à la demande
  const flush = useCallback(async () => {
    scheduled.current = false
    const batch = [...pending.current]
    pending.current.clear()
    if (!batch.length) return
    try {
      const signed = await api.signPhotos(batch)
      setUrls((u) => ({ ...u, ...signed }))
    } catch {
      batch.forEach((p) => signing.current.delete(p))
    }
  }, [])

  const photoUrl = useCallback(
    (path: string | null) => {
      if (!path) return null
      if (urls[path]) return urls[path]
      if (!signing.current.has(path)) {
        signing.current.add(path)
        pending.current.add(path)
        if (!scheduled.current) {
          scheduled.current = true
          setTimeout(flush, 0)
        }
      }
      return null
    },
    [urls, flush],
  )

  const items = useMemo<Item[]>(() => {
    const out: Item[] = []
    for (const copy of copies) {
      const game = games.get(copy.game_id)
      if (game) out.push({ copy, game })
    }
    return out
  }, [games, copies])

  // ---- Écritures
  const upsertGame = (g: Game) => setGames((m) => new Map(m).set(g.id, g))
  const upsertCopy = (c: Copy) =>
    setCopies((list) => {
      const i = list.findIndex((x) => x.id === c.id)
      if (i < 0) return [...list, c]
      const next = list.slice()
      next[i] = c
      return next
    })

  const store: Store = {
    session,
    authReady,
    loading,
    ready,
    error,
    games,
    copies,
    items,
    photoUrl,
    reload,
    async createGameWithCopy(gi, ci) {
      const game = await api.insertGame(gi)
      upsertGame(game)
      const copy = await api.insertCopy({ ...ci, game_id: game.id })
      upsertCopy(copy)
      return { game, copy }
    },
    async saveGame(id, patch) {
      const g = await api.updateGame(id, patch)
      upsertGame(g)
      return g
    },
    async removeGame(id) {
      const paths = copies.filter((c) => c.game_id === id && c.image_path).map((c) => c.image_path!)
      await api.deleteGame(id)
      await Promise.all(paths.map((p) => api.removePhoto(p).catch(() => {})))
      setGames((m) => {
        const n = new Map(m)
        n.delete(id)
        return n
      })
      setCopies((l) => l.filter((c) => c.game_id !== id))
    },
    async addCopy(ci) {
      const c = await api.insertCopy(ci)
      upsertCopy(c)
      return c
    },
    async saveCopy(id, patch) {
      const c = await api.updateCopy(id, patch)
      upsertCopy(c)
      return c
    },
    async removeCopy(id) {
      const old = copies.find((c) => c.id === id)
      await api.deleteCopy(id)
      if (old?.image_path) await api.removePhoto(old.image_path).catch(() => {})
      setCopies((l) => l.filter((c) => c.id !== id))
    },
    async setPhoto(copy, file) {
      if (!uid) throw new Error('Non connecté')
      const blob = await compressImage(file)
      const path = await api.uploadPhoto(uid, copy.id, blob)
      setUrls((u) => ({ ...u, [path]: URL.createObjectURL(blob) }))
      const c = await api.updateCopy(copy.id, { image_path: path })
      upsertCopy(c)
      if (copy.image_path) await api.removePhoto(copy.image_path).catch(() => {})
    },
    async clearPhoto(copy) {
      if (!copy.image_path) return
      const c = await api.updateCopy(copy.id, { image_path: null })
      upsertCopy(c)
      await api.removePhoto(copy.image_path).catch(() => {})
    },
    async signOut() {
      if (uid) localStorage.removeItem(cacheKey(uid))
      await supabase?.auth.signOut()
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider manquant')
  return s
}
