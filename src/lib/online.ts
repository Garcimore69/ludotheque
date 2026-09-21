import { FunctionsHttpError } from '@supabase/supabase-js'
import { norm as baseNorm } from './query'
import { supabase } from './supabase'
import type { Family, Game, Kind } from './types'

/** Comparaison de titres : sans accents, casse ni ponctuation. */
export const norm = (s: string) => baseNorm(s).replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, ' ').trim()

// ---------------------------------------------------------------- Types (miroir de la fonction serveur)

export type OnlineSource = 'bgg' | 'igdb' | 'openlibrary'

export interface Candidate {
  source: OnlineSource
  id: string
  family: Family
  title: string
  alt: string | null
  year: number | null
  thumb: string | null
  cover: string | null
  platforms: string[]
  info: string | null
  kind: Kind
  exact: boolean
}

export interface Draft {
  family: Family
  kind: Kind
  title: string
  subtitle: string | null
  original_title: string | null
  year: number | null
  series: string | null
  publishers: string[]
  authors: string[]
  illustrators: string[]
  developers: string[]
  genres: string[]
  mechanics: string[]
  themes: string[]
  languages: string[]
  description: string | null
  cover_url: string | null
  cover_thumb: string | null
  players_min: number | null
  players_max: number | null
  duration_min: number | null
  duration_max: number | null
  age_min: number | null
  weight: number | null
  community_rating: number | null
  rpg_system: string | null
  isbn: string | null
  source: OnlineSource
  external_id: string
  base_external_id: string | null
  base_title?: string | null
  platforms: string[]
}

export interface Ping {
  sources: Record<string, boolean>
  checks: Record<string, string>
  version: number
}

export interface BarcodeAnswer {
  candidates: Candidate[]
  product: { title: string; query: string; platform: string | null; image: string | null } | null
  errors: Record<string, string>
}

export const SOURCE_LABEL: Record<string, string> = {
  bgg: 'BoardGameGeek',
  rpggeek: 'RPGGeek',
  igdb: 'IGDB',
  openlibrary: 'Open Library',
  gameupc: 'GameUPC',
  upcitemdb: 'UPCitemdb',
}

// ---------------------------------------------------------------- Appels à la fonction « recherche »

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase n’est pas configuré')
  const { data, error } = await supabase.functions.invoke('recherche', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response
      if (res.status === 404) throw new Error('La fonction « recherche » n’est pas encore déployée dans Supabase (voir le guide du lot 2).')
      let msg = `erreur ${res.status}`
      try {
        const j = await res.json()
        if (j?.error) msg = j.error
      } catch {
        /* réponse non JSON */
      }
      throw new Error(msg)
    }
    throw new Error(navigator.onLine ? `Recherche en ligne injoignable (${error.message})` : 'Pas de connexion internet')
  }
  return data as T
}

export const ping = (check = false) => call<Ping>({ action: 'ping', check })

export const searchOnline = (q: string, families: Family[]) =>
  call<{ results: Candidate[]; errors: Record<string, string> }>({ action: 'search', q, families })

/** product=false : pas d'appel à UPCitemdb (quota de 100/jour), pour les traitements par lot. */
export const lookupBarcode = (code: string, product = true) => call<BarcodeAnswer>({ action: 'barcode', code, product })

export const fetchDetails = async (source: OnlineSource, id: string) => (await call<{ draft: Draft }>({ action: 'details', source, id })).draft

// ---------------------------------------------------------------- Codes-barres

export const cleanCode = (s: string) => s.replace(/[^\dXx]/g, '').toUpperCase()

/** Clé de comparaison : un UPC-A (12) et son EAN-13 (0 + 12) sont le même code. */
export const codeKey = (s: string) => cleanCode(s).replace(/^0+(?=\d{8})/, '')

/** Somme de contrôle EAN-8 / UPC-A / EAN-13 / GTIN-14. */
export function validEan(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false
  const d = code.split('').map(Number)
  const check = d.pop()!
  const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

export const isIsbn = (s: string) => /^(97[89]\d{10}|\d{9}[\dX])$/.test(cleanCode(s))

/** Jeux de ma collection qui portent ce code (codes-barres ou ISBN). */
export function gamesByCode(games: Iterable<Game>, code: string): Game[] {
  const k = codeKey(code)
  const out: Game[] = []
  for (const g of games) {
    if (g.barcodes.some((b) => codeKey(b) === k) || (g.isbn && codeKey(g.isbn) === k)) out.push(g)
  }
  return out
}

export function withBarcode(g: Game, code: string): string[] | null {
  const c = cleanCode(code)
  if (!c || g.barcodes.some((b) => codeKey(b) === codeKey(c))) return null
  return [...g.barcodes, c]
}

// ---------------------------------------------------------------- Rapprochements avec la collection

/** Jeu déjà présent dans la collection pour ce résultat en ligne. */
export function gameForCandidate(games: Iterable<Game>, source: OnlineSource, id: string): Game | undefined {
  for (const g of games) {
    if (g.ext_ids?.[source] === id) return g
    if (g.source === source && g.external_id === id) return g
  }
  return undefined
}

/** Recherche locale instantanée : titre, VF, titre original, gamme, éditeurs, codes. */
export function localSearch(games: Iterable<Game>, q: string, limit = 8): Game[] {
  const nq = norm(q)
  if (nq.length < 2) return []
  const code = cleanCode(q)
  const scored: [number, Game][] = []
  for (const g of games) {
    const t = norm(g.title)
    let s = -1
    if (t === nq) s = 0
    else if (t.startsWith(nq)) s = 1
    else if (t.includes(nq)) s = 2
    else if ([g.original_title, g.subtitle, g.series].some((x) => x && norm(x).includes(nq))) s = 3
    else if (g.publishers.some((p) => norm(p).includes(nq))) s = 4
    else if (code.length >= 8 && gamesByCode([g], code).length) s = 0
    if (s >= 0) scored.push([s, g])
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title, 'fr'))
    .slice(0, limit)
    .map(([, g]) => g)
}

// ---------------------------------------------------------------- Passage de relais entre écrans

export interface Pending {
  at?: number
  draft?: Draft
  barcode?: string
  wishlist?: boolean
  platformHint?: string | null
}

const KEY = 'ludo-pending'

export function setPending(p: Pending) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }))
  } catch {
    /* stockage indisponible : le relais se perd, sans gravité */
  }
}

export function peekPending(): Pending {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Pending
    // Relais périmé (écran abandonné) : ignoré
    return p.at && Date.now() - p.at < 30 * 60e3 ? p : {}
  } catch {
    return {}
  }
}

export function clearPending() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* rien */
  }
}

/** Garde le titre choisi (souvent la VF) et range le titre de la source en titre original. */
export function draftFromCandidate(d: Draft, c: Candidate): Draft {
  if (c.title && norm(c.title) !== norm(d.title)) {
    return { ...d, title: c.title, original_title: d.original_title ?? d.title }
  }
  return d
}

/** Champs de la fiche à partir d'un brouillon en ligne (sans le relais des plateformes). */
export function draftToGame(d: Draft, games: Iterable<Game>) {
  const list = [...games]
  const bt = d.base_title ? norm(d.base_title) : null
  const base =
    (d.base_external_id ? gameForCandidate(list, d.source, d.base_external_id) : undefined) ??
    (bt ? list.find((g) => g.family === d.family && g.kind !== 'extension' && [g.title, g.original_title].some((t) => t && norm(t) === bt)) : undefined)
  return {
    family: d.family,
    kind: d.kind,
    title: d.title,
    subtitle: d.subtitle,
    original_title: d.original_title,
    year: d.year,
    series: d.series,
    publishers: d.publishers,
    authors: d.authors,
    illustrators: d.illustrators,
    developers: d.developers,
    genres: d.genres,
    mechanics: d.mechanics,
    themes: d.themes,
    languages: d.languages,
    description: d.description,
    cover_url: d.cover_url,
    cover_thumb: d.cover_thumb,
    players_min: d.players_min,
    players_max: d.players_max,
    duration_min: d.duration_min,
    duration_max: d.duration_max,
    age_min: d.age_min,
    weight: d.weight,
    community_rating: d.community_rating,
    rpg_system: d.rpg_system,
    isbn: d.isbn,
    base_game_id: base?.id ?? null,
    ext_ids: { [d.source]: d.external_id },
  }
}

/** Lien vers la page du jeu dans la source. */
export function sourceUrl(source: string, id: string, family?: Family): string | null {
  if (source === 'bgg') return family === 'jdr' ? `https://rpggeek.com/rpgitem/${id}` : `https://boardgamegeek.com/boardgame/${id}`
  if (source === 'openlibrary') return id.startsWith('/') ? `https://openlibrary.org${id}` : `https://openlibrary.org/isbn/${id}`
  return null
}

// ---------------------------------------------------------------- Rapprochement automatique (jaquettes par lot)

export interface Match {
  cand: Candidate
  confident: boolean
  why: string
}

/**
 * Meilleur résultat en ligne pour un jeu de la collection.
 * Sûr seulement si le titre est identique (titre ou titre original) et, pour un JV,
 * si la plateforme de mon exemplaire fait partie des plateformes du résultat.
 */
export function bestMatch(game: Game, cands: Candidate[], myPlatforms: string[], toLocal: (names: string[]) => string[]): Match | null {
  const usable = cands.filter((c) => c.family === game.family && (c.cover || c.thumb))
  if (!usable.length) return null
  const titles = [game.title, game.original_title].filter(Boolean).map((t) => norm(t!))
  const same = (c: Candidate) => titles.includes(norm(c.title)) || (!!c.alt && titles.includes(norm(c.alt)))
  const onMine = (c: Candidate) => !myPlatforms.length || toLocal(c.platforms).some((p) => myPlatforms.includes(p))
  const kindOk = (c: Candidate) => (game.kind === 'extension') === (c.kind === 'extension')

  let pool = usable.filter((c) => same(c) && onMine(c))
  if (pool.length > 1) {
    const k = pool.filter(kindOk)
    if (k.length) pool = k
  }
  if (pool.length > 1 && game.year) {
    const y = pool.filter((c) => c.year === game.year)
    if (y.length) pool = y
  }
  if (pool.length === 1) return { cand: pool[0], confident: true, why: game.family === 'jv' ? 'titre et plateforme identiques' : 'titre identique' }
  if (pool.length > 1) return { cand: pool[0], confident: false, why: `${pool.length} résultats de même titre` }
  const loose = usable.find((c) => same(c)) ?? usable[0]
  return { cand: loose, confident: false, why: same(loose) ? 'plateforme différente' : 'titre approchant' }
}
