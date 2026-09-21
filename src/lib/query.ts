import { completeness, platformFamily, familyLabel, playStatusLabel, statusLabel } from './labels'
import type { Condition, Family, Format, Item, PlayStatus, Region, Status } from './types'

export type SortKey =
  | 'title'
  | 'added'
  | 'acquired'
  | 'year'
  | 'rating'
  | 'community'
  | 'platform'
  | 'family'
  | 'players'
  | 'duration'
  | 'weight'
  | 'price'
  | 'value'
  | 'location'
  | 'playStatus'
export type Dir = 'asc' | 'desc'
export type GroupKey = 'none' | 'letter' | 'family' | 'platform' | 'platformFamily' | 'year' | 'series' | 'status'
export type View = 'grid' | 'list' | 'table'

export const SORTS: { key: SortKey; label: string; dir: Dir }[] = [
  { key: 'title', label: 'Titre', dir: 'asc' },
  { key: 'added', label: 'Date d’ajout', dir: 'desc' },
  { key: 'acquired', label: 'Date d’acquisition', dir: 'desc' },
  { key: 'year', label: 'Année de sortie', dir: 'desc' },
  { key: 'rating', label: 'Note perso', dir: 'desc' },
  { key: 'community', label: 'Note communauté', dir: 'desc' },
  { key: 'platform', label: 'Plateforme', dir: 'asc' },
  { key: 'family', label: 'Type de jeu', dir: 'asc' },
  { key: 'players', label: 'Nb de joueurs max', dir: 'desc' },
  { key: 'duration', label: 'Durée', dir: 'asc' },
  { key: 'weight', label: 'Poids (g)', dir: 'desc' },
  { key: 'price', label: 'Prix payé', dir: 'desc' },
  { key: 'value', label: 'Valeur / cote', dir: 'desc' },
  { key: 'location', label: 'Emplacement', dir: 'asc' },
  { key: 'playStatus', label: 'Statut de jeu', dir: 'asc' },
]
export const sortLabel = (k: SortKey) => SORTS.find((s) => s.key === k)?.label ?? k

export const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'none', label: 'Aucun' },
  { key: 'letter', label: 'Initiale' },
  { key: 'family', label: 'Type de jeu' },
  { key: 'platform', label: 'Plateforme' },
  { key: 'platformFamily', label: 'Constructeur' },
  { key: 'year', label: 'Année de sortie' },
  { key: 'series', label: 'Gamme' },
  { key: 'status', label: 'Statut' },
]

export interface Filters {
  statuses: Status[]
  includeExtensions: boolean
  playStatus: (PlayStatus | 'none')[]
  platforms: string[]
  formats: Format[]
  regions: Region[]
  completeness: string[]
  conditions: Condition[]
  players: number | null
  durationMax: number | null
  ageMax: number | null
  ratingMin: number | null
  unrated: boolean
  communityMin: number | null
  yearFrom: number | null
  yearTo: number | null
  addedDays: number | null
  languages: string[]
  publishers: string[]
  locations: string[]
  tags: string[]
  series: string[]
  genres: string[]
}

export interface Query {
  family: Family | 'all'
  text: string
  sort1: SortKey
  dir1: Dir
  sort2: SortKey
  dir2: Dir
  group: GroupKey
  view: View
  filters: Filters
}

export const emptyFilters = (): Filters => ({
  statuses: [],
  includeExtensions: true,
  playStatus: [],
  platforms: [],
  formats: [],
  regions: [],
  completeness: [],
  conditions: [],
  players: null,
  durationMax: null,
  ageMax: null,
  ratingMin: null,
  unrated: false,
  communityMin: null,
  yearFrom: null,
  yearTo: null,
  addedDays: null,
  languages: [],
  publishers: [],
  locations: [],
  tags: [],
  series: [],
  genres: [],
})

export const defaultQuery = (): Query => ({
  family: 'all',
  text: '',
  sort1: 'title',
  dir1: 'asc',
  sort2: 'platform',
  dir2: 'asc',
  group: 'letter',
  view: 'grid',
  filters: emptyFilters(),
})

/** Nombre de filtres actifs (pour la pastille du bouton « Filtrer »). */
export function activeCount(f: Filters): number {
  const e = emptyFilters()
  let n = 0
  for (const k of Object.keys(e) as (keyof Filters)[]) {
    const v = f[k]
    const d = e[k]
    if (Array.isArray(v)) n += v.length ? 1 : 0
    else if (v !== d) n += 1
  }
  return n
}

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

const any = <T,>(sel: T[], v: T | null | undefined) => !sel.length || (v != null && sel.includes(v))
const anyOf = (sel: string[], vs: string[]) => !sel.length || vs.some((v) => sel.includes(v))

export function haystack({ game, copy }: Item): string {
  return norm(
    [
      game.title,
      game.subtitle,
      game.original_title,
      game.series,
      copy.platform,
      copy.edition,
      copy.location,
      ...game.publishers,
      ...game.developers,
      ...game.authors,
      ...copy.tags,
      ...game.barcodes,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

export function matches(it: Item, q: Query, now = Date.now()): boolean {
  const { game: g, copy: c } = it
  const f = q.filters
  if (q.family !== 'all' && g.family !== q.family) return false
  if (!f.includeExtensions && g.kind === 'extension') return false
  if (!any(f.statuses, c.status)) return false
  if (f.playStatus.length && !f.playStatus.includes(c.play_status ?? 'none')) return false
  if (!any(f.platforms, c.platform)) return false
  if (!any(f.formats, c.format)) return false
  if (!any(f.regions, c.region)) return false
  if (!any(f.completeness, completeness(c))) return false
  if (!any(f.conditions, c.condition)) return false
  if (f.players != null) {
    if (g.players_min == null) return false
    if (g.players_min > f.players) return false
    if (g.players_max != null && g.players_max < f.players) return false
  }
  if (f.durationMax != null && (g.duration_min == null || g.duration_min > f.durationMax)) return false
  if (f.ageMax != null && (g.age_min == null || g.age_min > f.ageMax)) return false
  if (f.unrated) {
    if (c.rating != null) return false
  } else if (f.ratingMin != null && (c.rating == null || c.rating < f.ratingMin)) return false
  if (f.communityMin != null && (g.community_rating == null || g.community_rating < f.communityMin)) return false
  if (f.yearFrom != null && (g.year == null || g.year < f.yearFrom)) return false
  if (f.yearTo != null && (g.year == null || g.year > f.yearTo)) return false
  if (f.addedDays != null && now - new Date(c.added_at).getTime() > f.addedDays * 86400000) return false
  if (!anyOf(f.languages, c.language ? [c.language, ...g.languages] : g.languages)) return false
  if (!anyOf(f.publishers, g.publishers)) return false
  if (!any(f.locations, c.location)) return false
  if (!anyOf(f.tags, c.tags)) return false
  if (!any(f.series, g.series)) return false
  if (!anyOf(f.genres, g.genres)) return false
  if (q.text.trim()) {
    const words = norm(q.text).split(/\s+/).filter(Boolean)
    const h = haystack(it)
    if (!words.every((w) => h.includes(w))) return false
  }
  return true
}

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })
const PLAY_ORDER: Record<string, number> = { en_cours: 0, a_faire: 1, fini: 2, cent: 3 }

function value(it: Item, k: SortKey): string | number | null {
  const { game: g, copy: c } = it
  switch (k) {
    case 'title':
      return g.title
    case 'added':
      return new Date(c.added_at).getTime()
    case 'acquired':
      return c.acquired_on ? new Date(c.acquired_on).getTime() : null
    case 'year':
      return g.year
    case 'rating':
      return c.rating
    case 'community':
      return g.community_rating
    case 'platform':
      return c.platform
    case 'family':
      return familyLabel[g.family]
    case 'players':
      return g.players_max ?? g.players_min
    case 'duration':
      return g.duration_min ?? g.duration_max
    case 'weight':
      return c.weight_g
    case 'price':
      return c.price_paid
    case 'value':
      return c.value_estimate
    case 'location':
      return c.location
    case 'playStatus':
      return c.play_status ? PLAY_ORDER[c.play_status] : null
  }
}

function cmp(a: Item, b: Item, k: SortKey, d: Dir): number {
  const va = value(a, k)
  const vb = value(b, k)
  if (va == null && vb == null) return 0
  if (va == null) return 1 // valeurs vides toujours en fin de liste
  if (vb == null) return -1
  const r = typeof va === 'string' || typeof vb === 'string' ? collator.compare(String(va), String(vb)) : va - (vb as number)
  return d === 'asc' ? r : -r
}

export function sortItems(list: Item[], q: Query): Item[] {
  return list.slice().sort(
    (a, b) =>
      cmp(a, b, q.sort1, q.dir1) || cmp(a, b, q.sort2, q.dir2) || collator.compare(a.game.title, b.game.title),
  )
}

export function groupOf(it: Item, g: GroupKey): string {
  const { game, copy } = it
  switch (g) {
    case 'none':
      return ''
    case 'letter': {
      const ch = norm(game.title.replace(/^[^\p{L}\p{N}]+/u, '')).charAt(0).toUpperCase()
      return /[A-Z]/.test(ch) ? ch : '#'
    }
    case 'family':
      return familyLabel[game.family]
    case 'platform':
      return copy.platform ?? (game.family === 'jv' ? 'Plateforme inconnue' : familyLabel[game.family])
    case 'platformFamily':
      return game.family === 'jv' ? platformFamily(copy.platform) : familyLabel[game.family]
    case 'year':
      return game.year ? String(game.year) : 'Année inconnue'
    case 'series':
      return game.series ?? 'Sans gamme'
    case 'status':
      return statusLabel[copy.status]
  }
}

export interface Group {
  key: string
  items: Item[]
}

/** Regroupe en conservant l'ordre de tri (les groupes apparaissent dans l'ordre de leur 1er élément). */
export function groupItems(list: Item[], g: GroupKey): Group[] {
  if (g === 'none') return [{ key: '', items: list }]
  const map = new Map<string, Item[]>()
  for (const it of list) {
    const k = groupOf(it, g)
    const arr = map.get(k)
    if (arr) arr.push(it)
    else map.set(k, [it])
  }
  const groups = [...map.entries()].map(([key, items]) => ({ key, items }))
  if (g === 'letter' || g === 'platform' || g === 'platformFamily' || g === 'series')
    groups.sort((a, b) => collator.compare(a.key, b.key))
  if (g === 'year') groups.sort((a, b) => Number(b.key) - Number(a.key) || 0)
  return groups
}

/** Valeurs possibles d'un champ + nombre d'exemplaires (pour les listes de filtres). */
export function facet(list: Item[], get: (it: Item) => (string | null | undefined)[]): [string, number][] {
  const m = new Map<string, number>()
  for (const it of list) for (const v of new Set(get(it))) if (v) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]))
}

export { playStatusLabel }
