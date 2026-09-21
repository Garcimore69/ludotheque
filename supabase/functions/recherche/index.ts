// ============================================================================
// Ma Ludothèque – fonction serveur « recherche » (lot 2)
//
// Proxy entre l'app et les sources en ligne. Les jetons d'API restent ici,
// dans les secrets Supabase, et ne sont jamais envoyés au navigateur.
//
//   BoardGameGeek (JdS + JdR)  secret BGG_TOKEN
//   IGDB via Twitch (JV)       secrets TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
//   GameUPC (EAN → BGG)        sans clé (clé de test publique), GAMEUPC_KEY facultatif
//   UPCitemdb (EAN → titre)    sans clé (palier d'essai), UPCITEMDB_KEY facultatif
//   Open Library (ISBN, JdR)   sans clé
//
// Seul un compte connecté à l'app peut l'appeler (vérifié à chaque requête).
// Fichier unique et sans dépendance : il se colle tel quel dans l'éditeur
// Supabase (Edge Functions > Deploy a new function > Via Editor).
// ============================================================================

type Family = 'jds' | 'jv' | 'jdr'
type Kind = 'base' | 'extension' | 'standalone'
type Source = 'bgg' | 'igdb' | 'openlibrary'

export interface Candidate {
  source: Source
  id: string
  family: Family
  title: string
  alt: string | null // autre titre (original ou VF)
  year: number | null
  thumb: string | null
  cover: string | null // image pleine taille (jaquette)
  platforms: string[] // JV : plateformes de la source
  info: string | null // plateformes, éditeur, auteur…
  kind: Kind
  exact: boolean // titre identique à la recherche, ou code-barre vérifié
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
  source: Source
  external_id: string
  base_external_id: string | null // jeu de base (même source)
  base_title: string | null // son titre, pour le retrouver dans la collection
  platforms: string[] // JV : plateformes connues de la source
}

// ---------------------------------------------------------------- utilitaires

// deno-lint-ignore no-explicit-any
const g = globalThis as any
const env = (k: string): string => (g.Deno?.env?.get(k) as string | undefined)?.trim() ?? ''
const UA = 'MaLudotheque/2.0 (+https://github.com/Garcimore69/ludotheque)'

class SourceError extends Error {}

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => x?.trim()).filter(Boolean) as string[])]
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : null
}
const pos = (v: unknown): number | null => {
  const n = num(v)
  return n != null && n > 0 ? n : null
}

async function http(url: string, init: RequestInit = {}, timeout = 9000): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('User-Agent')) headers.set('User-Agent', UA)
  return await fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeout) })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Petit cache en mémoire (durée de vie de l'instance) : épargne les quotas.
const CACHE = new Map<string, { at: number; v: unknown }>()
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T
  const v = await fn()
  CACHE.set(key, { at: Date.now(), v })
  if (CACHE.size > 800) CACHE.delete(CACHE.keys().next().value!)
  return v
}

// ---------------------------------------------------------------- XML (BGG)

export interface XNode {
  name: string
  attrs: Record<string, string>
  children: XNode[]
  text: string
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', times: '×', eacute: 'é',
  egrave: 'è', agrave: 'à', ccedil: 'ç', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß', deg: '°', copy: '©', reg: '®',
}

export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return NAMED[e.toLowerCase()] ?? m
  })
}

export function parseXml(xml: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, children: [], text: '' }
  const stack = [root]
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1]
    if (m[1] != null) top.text += m[1]
    else if (m[2]) {
      if (stack.length > 1 && top.name === m[2]) stack.pop()
    } else if (m[3]) {
      const attrs: Record<string, string> = {}
      const ar = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
      let a: RegExpExecArray | null
      while ((a = ar.exec(m[4] ?? ''))) attrs[a[1]] = decode(a[2] ?? a[3] ?? '')
      const node: XNode = { name: m[3], attrs, children: [], text: '' }
      top.children.push(node)
      if (!m[5]) stack.push(node)
    } else if (m[6] != null) top.text += decode(m[6])
  }
  return root
}

const kids = (n: XNode | undefined, name: string) => n?.children.filter((c) => c.name === name) ?? []
const kid = (n: XNode | undefined, name: string) => n?.children.find((c) => c.name === name)
const val = (n: XNode | undefined, name: string) => kid(n, name)?.attrs.value

// ---------------------------------------------------------------- BoardGameGeek

const BGG = 'https://boardgamegeek.com/xmlapi2'
let bggLast = 0

async function bgg(path: string): Promise<XNode> {
  const token = env('BGG_TOKEN')
  if (!token) throw new SourceError('BGG non configuré (secret BGG_TOKEN)')
  return await cached(`bgg:${path}`, 6 * 3600e3, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      // BGG demande de rester sobre : au plus une requête par seconde.
      const wait = bggLast + 1000 - Date.now()
      if (wait > 0) await sleep(wait)
      bggLast = Date.now()
      const res = await http(`${BGG}/${path}`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 202 || res.status === 429 || res.status >= 500) {
        await sleep(1500 * (attempt + 1))
        continue
      }
      if (res.status === 401 || res.status === 403) throw new SourceError('BGG refuse le jeton (BGG_TOKEN)')
      if (!res.ok) throw new SourceError(`BGG : erreur ${res.status}`)
      return parseXml(await res.text())
    }
    throw new SourceError('BGG est saturé, réessaie dans un instant')
  })
}

const BGG_TYPES: Record<Family, string> = { jds: 'boardgame,boardgameexpansion', jdr: 'rpgitem', jv: '' }

function bggKind(type: string): Kind {
  return type === 'boardgameexpansion' ? 'extension' : 'base'
}

export function rank<T extends { title: string; alt: string | null }>(list: T[], q: string): (T & { exact: boolean })[] {
  const nq = norm(q)
  const score = (c: T) => {
    const t = norm(c.title)
    const a = c.alt ? norm(c.alt) : ''
    if (t === nq || a === nq) return 0
    if (t.startsWith(nq) || a.startsWith(nq)) return 1
    if (t.includes(nq) || a.includes(nq)) return 2
    return 3
  }
  return list
    .map((c, i) => ({ c, i, s: score(c) }))
    .sort((x, y) => x.s - y.s || x.i - y.i)
    .map(({ c, s }) => ({ ...c, exact: s === 0 }))
}

async function bggSearch(q: string, family: 'jds' | 'jdr'): Promise<Candidate[]> {
  const root = await bgg(`search?query=${encodeURIComponent(q)}&type=${BGG_TYPES[family]}`)
  const seen = new Map<string, { id: string; type: string; name: string; primary: boolean; year: number | null }>()
  for (const it of kids(kid(root, 'items'), 'item')) {
    const id = it.attrs.id
    const n = kid(it, 'name')
    if (!id || !n || seen.has(id)) continue
    seen.set(id, { id, type: it.attrs.type, name: n.attrs.value, primary: n.attrs.type === 'primary', year: num(val(it, 'yearpublished')) })
  }
  const found = rank(
    [...seen.values()].map((x) => ({ ...x, title: x.name, alt: null })),
    q,
  ).slice(0, 20)
  if (!found.length) return []
  // 2e appel groupé : vignettes, titre principal, type exact
  const things = await bggThings(found.map((f) => f.id))
  return found.map((f) => {
    const t = things.get(f.id)
    const primary = t ? t.primary : f.name
    return {
      source: 'bgg' as const,
      id: f.id,
      family,
      title: f.name, // le titre trouvé (souvent la VF)
      alt: primary !== f.name ? primary : null,
      year: f.year ?? t?.year ?? null,
      thumb: t?.thumb ?? null,
      cover: t?.cover ?? null,
      platforms: [],
      info: t?.info ?? null,
      kind: bggKind(t?.type ?? f.type),
      exact: f.exact,
    }
  })
}

async function bggThings(ids: string[]) {
  const out = new Map<string, { primary: string; year: number | null; thumb: string | null; cover: string | null; type: string; info: string | null }>()
  for (let i = 0; i < ids.length; i += 20) {
    const root = await bgg(`thing?id=${ids.slice(i, i + 20).join(',')}`)
    for (const it of kids(kid(root, 'items'), 'item')) {
      const names = kids(it, 'name')
      const primary = (names.find((n) => n.attrs.type === 'primary') ?? names[0])?.attrs.value ?? ''
      const pub = kids(it, 'link').find((l) => /publisher$/.test(l.attrs.type))?.attrs.value ?? null
      const pmin = num(val(it, 'minplayers'))
      const pmax = num(val(it, 'maxplayers'))
      const players = pmin ? (pmax && pmax !== pmin ? `${pmin}–${pmax} j` : `${pmin} j`) : null
      out.set(it.attrs.id, {
        primary,
        year: pos(val(it, 'yearpublished')),
        thumb: kid(it, 'thumbnail')?.text.trim() || null,
        cover: kid(it, 'image')?.text.trim() || null,
        type: it.attrs.type,
        info: [players, pub].filter(Boolean).join(' · ') || null,
      })
    }
  }
  return out
}

export function bggDraft(it: XNode): Draft {
  const type = it.attrs.type
  const family: Family = type === 'rpgitem' ? 'jdr' : 'jds'
  const names = kids(it, 'name')
  const primary = (names.find((n) => n.attrs.type === 'primary') ?? names[0])?.attrs.value ?? ''
  const links = kids(it, 'link')
  const link = (re: RegExp, inbound?: boolean) =>
    uniq(links.filter((l) => re.test(l.attrs.type) && (inbound == null || (l.attrs.inbound === 'true') === inbound)).map((l) => l.attrs.value))
  const ratings = kid(kid(it, 'statistics'), 'ratings')
  const avg = num(val(ratings, 'average'))
  const weight = num(val(ratings, 'averageweight'))
  // Descriptions BGG : entités doublement encodées (&amp;#10;)
  const desc = decode(kid(it, 'description')?.text ?? '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const dmin = pos(val(it, 'minplaytime')) ?? pos(val(it, 'playingtime'))
  const dmax = pos(val(it, 'maxplaytime')) ?? pos(val(it, 'playingtime'))
  const baseLink = links.find((l) => l.attrs.type === 'boardgameexpansion' && l.attrs.inbound === 'true')
  const pmax = pos(val(it, 'maxplayers'))
  return {
    family,
    kind: bggKind(type),
    title: primary,
    subtitle: null,
    original_title: null,
    year: pos(val(it, 'yearpublished')),
    series: family === 'jdr' ? (link(/^rpg$/)[0] ?? link(/rpgseries/)[0] ?? null) : null,
    publishers: link(/publisher$/).filter((p) => !/^\(.*\)$/.test(p)).slice(0, 5),
    authors: link(/designer$/).filter((p) => !/^\(.*\)$/.test(p)),
    illustrators: link(/artist$/).filter((p) => !/^\(.*\)$/.test(p)).slice(0, 6),
    developers: [],
    genres: link(/(boardgamecategory|rpggenre)$/),
    mechanics: link(/boardgamemechanic$/),
    themes: [],
    languages: [],
    description: desc || null,
    cover_url: kid(it, 'image')?.text.trim() || null,
    cover_thumb: kid(it, 'thumbnail')?.text.trim() || null,
    players_min: pos(val(it, 'minplayers')),
    players_max: pmax,
    duration_min: dmin,
    duration_max: dmax,
    age_min: pos(val(it, 'minage')),
    weight: weight && weight > 0 ? Math.round(weight * 100) / 100 : null,
    community_rating: avg && avg > 0 ? Math.round(avg * 100) / 100 : null,
    rpg_system: null,
    isbn: null,
    source: 'bgg',
    external_id: it.attrs.id,
    base_external_id: family === 'jds' && type === 'boardgameexpansion' ? (baseLink?.attrs.id ?? null) : null,
    base_title: family === 'jds' && type === 'boardgameexpansion' ? (baseLink?.attrs.value ?? null) : null,
    platforms: [],
  }
}

async function bggDetails(id: string): Promise<Draft> {
  const root = await bgg(`thing?id=${encodeURIComponent(id)}&stats=1`)
  const it = kid(kid(root, 'items'), 'item')
  if (!it) throw new SourceError('Jeu introuvable sur BGG')
  return bggDraft(it)
}

// ---------------------------------------------------------------- IGDB (Twitch)

let twitch: { token: string; exp: number } | null = null

async function twitchToken(force = false): Promise<string> {
  const id = env('TWITCH_CLIENT_ID')
  const secret = env('TWITCH_CLIENT_SECRET')
  if (!id || !secret) throw new SourceError('IGDB non configuré (secrets TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET)')
  if (!force && twitch && twitch.exp > Date.now() + 60e3) return twitch.token
  const res = await http(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`,
    { method: 'POST' },
  )
  if (!res.ok) throw new SourceError(`Twitch refuse les identifiants IGDB (${res.status})`)
  const j = await res.json()
  twitch = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return twitch.token
}

// deno-lint-ignore no-explicit-any
async function igdb(endpoint: string, body: string): Promise<any[]> {
  return await cached(`igdb:${endpoint}:${body}`, 6 * 3600e3, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = await twitchToken()
      const res = await http(`https://api.igdb.com/v4/${endpoint}`, {
        method: 'POST',
        headers: { 'Client-ID': env('TWITCH_CLIENT_ID'), Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'text/plain' },
        body,
      })
      if (res.status === 401) {
        twitch = null
        continue
      }
      if (res.status === 429) {
        await sleep(600)
        continue
      }
      if (!res.ok) throw new SourceError(`IGDB : erreur ${res.status} ${(await res.text()).slice(0, 160)}`)
      return await res.json()
    }
    throw new SourceError('IGDB indisponible, réessaie dans un instant')
  })
}

const igdbImg = (id: string | undefined, size: string) => (id ? `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.jpg` : null)
const igdbStr = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

function igdbKind(t: string | undefined): Kind {
  if (!t) return 'base'
  if (/standalone/i.test(t)) return 'standalone'
  if (/dlc|expansion|add.?on|episode|season|pack/i.test(t)) return 'extension'
  return 'base'
}

// Genres IGDB → vocabulaire de la collection (repris de Gamekult)
const IGDB_GENRES: Record<string, string> = {
  Adventure: 'Aventure', 'Role-playing (RPG)': 'Jeu de rôles', Shooter: 'Tir', Platform: 'Plates-formes', Puzzle: 'Réflexion',
  Racing: 'Course', Sport: 'Sport', Fighting: 'Combat', Strategy: 'Stratégie', 'Real Time Strategy (RTS)': 'Stratégie temps réel',
  'Turn-based strategy (TBS)': 'Stratégie tour par tour', Simulator: 'Simulation', "Hack and slash/Beat 'em up": "Beat'em up",
  Arcade: 'Arcade', Music: 'Musique', 'Point-and-click': 'Point & click', Tactical: 'Tactique', Indie: 'Indé', 'Quiz/Trivia': 'Quiz',
  'Card & Board Game': 'Jeu de société', 'Visual Novel': 'Visual novel', Pinball: 'Flipper', MOBA: 'MOBA',
}

// deno-lint-ignore no-explicit-any
function frenchName(g: any): string | null {
  // deno-lint-ignore no-explicit-any
  const alt = (g.alternative_names ?? []).find((a: any) => /fran[cç]ais|french/i.test(a.comment ?? ''))
  // deno-lint-ignore no-explicit-any
  const loc = (g.game_localizations ?? []).find((l: any) => /france|french/i.test(l.region?.name ?? ''))
  return (alt?.name ?? loc?.name ?? null) as string | null
}

const SEARCH_FIELDS = 'name,first_release_date,cover.image_id,platforms.name,game_type.type,alternative_names.name,alternative_names.comment'
const SEARCH_FIELDS_SAFE = 'name,first_release_date,cover.image_id,platforms.name'

async function igdbSearch(q: string): Promise<Candidate[]> {
  const run = (fields: string) => igdb('games', `search "${igdbStr(q)}"; fields ${fields}; limit 30;`)
  // deno-lint-ignore no-explicit-any
  let list: any[]
  try {
    list = await run(SEARCH_FIELDS)
  } catch (e) {
    if (!(e instanceof SourceError) || !/ 400 /.test(e.message)) throw e
    list = await run(SEARCH_FIELDS_SAFE)
  }
  return rank(
    list.map((x) => {
      const fr = frenchName(x)
      return {
        source: 'igdb' as const,
        id: String(x.id),
        family: 'jv' as const,
        title: fr ?? x.name,
        alt: fr && fr !== x.name ? x.name : null,
        year: x.first_release_date ? new Date(x.first_release_date * 1000).getUTCFullYear() : null,
        thumb: igdbImg(x.cover?.image_id, 'cover_small_2x'),
        cover: igdbImg(x.cover?.image_id, 'cover_big_2x'),
        // deno-lint-ignore no-explicit-any
        platforms: uniq((x.platforms ?? []).map((p: any) => p.name)),
        // deno-lint-ignore no-explicit-any
        info: (x.platforms ?? []).map((p: any) => p.name).join(', ') || null,
        kind: igdbKind(x.game_type?.type),
        exact: false,
      }
    }),
    q,
  ).slice(0, 20)
}

const DETAIL_FIELDS =
  'name,first_release_date,summary,cover.image_id,platforms.name,genres.name,themes.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,alternative_names.name,alternative_names.comment,total_rating,aggregated_rating,rating,game_type.type,parent_game.name,collections.name,franchises.name'
const DETAIL_FIELDS_SAFE =
  'name,first_release_date,summary,cover.image_id,platforms.name,genres.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,total_rating,parent_game'

// deno-lint-ignore no-explicit-any
export function igdbDraft(x: any): Draft {
  const fr = frenchName(x)
  // deno-lint-ignore no-explicit-any
  const companies = (x.involved_companies ?? []) as any[]
  const rating = num(x.total_rating ?? x.aggregated_rating ?? x.rating)
  return {
    family: 'jv',
    kind: igdbKind(x.game_type?.type),
    title: fr ?? x.name,
    subtitle: null,
    original_title: fr && fr !== x.name ? x.name : null,
    year: x.first_release_date ? new Date(x.first_release_date * 1000).getUTCFullYear() : null,
    series: x.collections?.[0]?.name ?? x.franchises?.[0]?.name ?? null,
    publishers: uniq(companies.filter((c) => c.publisher).map((c) => c.company?.name)).slice(0, 4),
    authors: [],
    illustrators: [],
    developers: uniq(companies.filter((c) => c.developer).map((c) => c.company?.name)).slice(0, 4),
    // deno-lint-ignore no-explicit-any
    genres: uniq((x.genres ?? []).map((g: any) => IGDB_GENRES[g.name] ?? g.name)),
    mechanics: [],
    themes: [],
    languages: [],
    description: x.summary ?? null,
    cover_url: igdbImg(x.cover?.image_id, 'cover_big_2x'),
    cover_thumb: igdbImg(x.cover?.image_id, 'cover_small_2x'),
    players_min: null,
    players_max: null,
    duration_min: null,
    duration_max: null,
    age_min: null,
    weight: null,
    community_rating: rating ? Math.round(rating * 10) / 100 : null,
    rpg_system: null,
    isbn: null,
    source: 'igdb',
    external_id: String(x.id),
    base_external_id: x.parent_game ? String(typeof x.parent_game === 'object' ? x.parent_game.id : x.parent_game) : null,
    base_title: typeof x.parent_game === 'object' ? (x.parent_game?.name ?? null) : null,
    // deno-lint-ignore no-explicit-any
    platforms: uniq((x.platforms ?? []).map((p: any) => p.name)),
  }
}

async function igdbDetails(id: string): Promise<Draft> {
  if (!/^\d+$/.test(id)) throw new SourceError('Identifiant IGDB invalide')
  const run = (fields: string) => igdb('games', `fields ${fields}; where id = ${id};`)
  // deno-lint-ignore no-explicit-any
  let list: any[]
  try {
    list = await run(DETAIL_FIELDS)
  } catch (e) {
    if (!(e instanceof SourceError) || !/ 400 /.test(e.message)) throw e
    list = await run(DETAIL_FIELDS_SAFE)
  }
  if (!list[0]) throw new SourceError('Jeu introuvable sur IGDB')
  return igdbDraft(list[0])
}

// ---------------------------------------------------------------- Open Library (livres, JdR)

const OL = 'https://openlibrary.org'
const olCover = (id: number | undefined, size: 'M' | 'L') => (id && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : null)

// deno-lint-ignore no-explicit-any
async function olJson(path: string): Promise<any | null> {
  return await cached(`ol:${path}`, 24 * 3600e3, async () => {
    const res = await http(`${OL}${path}`, { headers: { Accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new SourceError(`Open Library : erreur ${res.status}`)
    return await res.json()
  })
}

async function olSearch(q: string): Promise<Candidate[]> {
  const j = await olJson(`/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,subtitle,author_name,first_publish_year,cover_i,isbn,publisher`)
  // deno-lint-ignore no-explicit-any
  const docs = (j?.docs ?? []) as any[]
  return rank(
    docs.map((d) => ({
      source: 'openlibrary' as const,
      id: String(d.key),
      family: 'jdr' as const,
      title: d.title,
      alt: d.subtitle ?? null,
      year: num(d.first_publish_year),
      thumb: olCover(d.cover_i, 'M'),
      cover: olCover(d.cover_i, 'L'),
      platforms: [],
      info: [d.author_name?.[0], d.publisher?.[0]].filter(Boolean).join(' · ') || null,
      kind: 'base' as const,
      exact: false,
    })),
    q,
  )
}

const isIsbn = (s: string) => /^(97[89]\d{10}|\d{9}[\dX])$/i.test(s)

async function olDetails(id: string): Promise<Draft> {
  // deno-lint-ignore no-explicit-any
  let ed: any = null
  // deno-lint-ignore no-explicit-any
  let work: any = null
  let isbn: string | null = null
  if (isIsbn(id)) {
    isbn = id
    ed = await olJson(`/isbn/${id}.json`)
    if (!ed) throw new SourceError('ISBN inconnu d’Open Library')
    if (ed.works?.[0]?.key) work = await olJson(`${ed.works[0].key}.json`).catch(() => null)
  } else if (/^\/works\/OL\d+W$/.test(id)) {
    work = await olJson(`${id}.json`)
    if (!work) throw new SourceError('Ouvrage introuvable sur Open Library')
  } else throw new SourceError('Identifiant Open Library invalide')

  const authorKeys: string[] = uniq([...(ed?.authors ?? []), ...(work?.authors ?? []).map((a: { author?: { key: string } }) => a.author)].map((a) => a?.key))
  const authors = (await Promise.all(authorKeys.slice(0, 4).map((k) => olJson(`${k}.json`).catch(() => null)))).map((a) => a?.name).filter(Boolean)
  const desc = work?.description ?? ed?.description
  const year = num(String(ed?.publish_date ?? work?.first_publish_date ?? '').match(/\d{4}/)?.[0])
  const cover = (ed?.covers ?? work?.covers ?? []).find((c: number) => c > 0)
  const lang = (ed?.languages ?? []).map((l: { key: string }) => ({ '/languages/fre': 'français', '/languages/eng': 'anglais' })[l.key] ?? null)
  return {
    family: 'jdr',
    kind: 'base',
    title: ed?.title ?? work?.title ?? '',
    subtitle: ed?.subtitle ?? work?.subtitle ?? null,
    original_title: null,
    year: year && year > 1900 ? year : null,
    series: null,
    publishers: uniq(ed?.publishers ?? []).slice(0, 3),
    authors: uniq(authors),
    illustrators: [],
    developers: [],
    genres: [],
    mechanics: [],
    themes: [],
    languages: uniq(lang),
    description: (typeof desc === 'string' ? desc : desc?.value) ?? null,
    cover_url: olCover(cover, 'L'),
    cover_thumb: olCover(cover, 'M'),
    players_min: null,
    players_max: null,
    duration_min: null,
    duration_max: null,
    age_min: null,
    weight: null,
    community_rating: null,
    rpg_system: null,
    isbn: isbn ?? ed?.isbn_13?.[0] ?? null,
    source: 'openlibrary',
    external_id: isbn ?? id,
    base_external_id: null,
    base_title: null,
    platforms: [],
  }
}

// ---------------------------------------------------------------- Codes-barres

// deno-lint-ignore no-explicit-any
async function gameUpc(code: string): Promise<{ verified: boolean; items: any[] }> {
  const base = env('GAMEUPC_URL') || 'https://api.gameupc.com/test'
  const key = env('GAMEUPC_KEY') || 'test_test_test_test_test'
  return await cached(`gameupc:${code}`, 24 * 3600e3, async () => {
    const res = await http(`${base}/upc/${code}`, { headers: { 'x-api-key': key } })
    if (res.status === 404) return { verified: false, items: [] }
    if (!res.ok) throw new SourceError(`GameUPC : erreur ${res.status}`)
    const j = await res.json()
    const items = Array.isArray(j.bgg_info) ? j.bgg_info : []
    return { verified: j.bgg_info_status === 'verified', items }
  })
}

async function upcItemDb(code: string): Promise<{ title: string; category: string | null; image: string | null } | null> {
  const key = env('UPCITEMDB_KEY')
  const url = key ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${code}` : `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`
  return await cached(`upcitemdb:${code}`, 7 * 24 * 3600e3, async () => {
    const res = await http(url, { headers: key ? { user_key: key, key_type: '3scale' } : {} })
    if (res.status === 429) throw new SourceError('UPCitemdb : quota du jour atteint')
    if (res.status === 404 || res.status === 400) return null
    if (!res.ok) throw new SourceError(`UPCitemdb : erreur ${res.status}`)
    const j = await res.json()
    const it = j.items?.[0]
    return it?.title ? { title: String(it.title), category: it.category ?? null, image: it.images?.[0] ?? null } : null
  })
}

// Titre commercial → titre du jeu (on retire plateforme, région, mentions de boîte)
const PLATFORM_WORDS =
  /\b(nintendo\s+switch(\s*2)?|switch|ps[1-5]|ps\s?vita|psp|playstation\s*(\d|vita|portable)?|xbox\s*(one|360|series\s*[xs](\s*\|\s*s)?)?|wii\s*u?|nintendo\s*(3ds|ds|64|gamecube)|3ds|nds|ds|game\s?cube|gba|game\s*boy(\s*advance|\s*color)?|pc|dvd-?rom|mac|sega|dreamcast)\b/gi

export function cleanProductTitle(t: string): { title: string; platform: string | null } {
  const platform = t.match(PLATFORM_WORDS)?.[0]?.trim() ?? null
  let title = t
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(PLATFORM_WORDS, ' ')
    .replace(/\b(pal|ntsc|fr|uk|eur?|standard)\s+(edition|version)\b/gi, ' ')
    .replace(/\b(pal|ntsc|import|jeu\s+vid[ée]o|video\s*game|neuf|new|sealed)\b/gi, ' ')
  // séparateurs orphelins (« Titre - - », « - Titre »)
  title = title
    .replace(/(\s*[-–—:|,/]\s*)+(?=\s*$)/g, '')
    .replace(/^(\s*[-–—:|,/]\s*)+/g, '')
    .replace(/\s+[-–—|/]\s+(?=[-–—|/]|\s*$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { title: title || t.trim(), platform }
}

interface BarcodeResult {
  candidates: Candidate[]
  product: { title: string; query: string; platform: string | null; image: string | null } | null
}

async function barcode(code: string, errors: Record<string, string>, withProduct = true): Promise<BarcodeResult> {
  const out: Candidate[] = []
  const isbn = isIsbn(code)

  const [upc, book] = await Promise.all([
    gameUpc(code).catch((e) => {
      errors.gameupc = (e as Error).message
      return { verified: false, items: [] }
    }),
    isbn
      ? olDetails(code).catch((e) => {
          if (!/inconnu/.test((e as Error).message)) errors.openlibrary = (e as Error).message
          return null
        })
      : Promise.resolve(null),
  ])

  if (upc.items.length) {
    for (const it of upc.items.slice(0, 8)) {
      const id = String(it.id ?? it.bgg_id ?? '')
      if (!id) continue
      out.push({
        source: 'bgg',
        id,
        family: 'jds',
        title: String(it.name ?? ''),
        alt: null,
        year: num(it.published),
        thumb: it.thumbnail_url ?? null,
        cover: it.image_url ?? null,
        platforms: [],
        info: upc.verified ? 'Code-barre vérifié (GameUPC)' : 'Suggestion GameUPC',
        kind: 'base',
        exact: upc.verified,
      })
    }
    // Vignettes manquantes : un appel BGG groupé (si configuré)
    const missing = out.filter((c) => !c.thumb || !c.title)
    if (missing.length && env('BGG_TOKEN')) {
      try {
        const t = await bggThings(missing.map((c) => c.id))
        for (const c of missing) {
          const x = t.get(c.id)
          if (!x) continue
          c.thumb ??= x.thumb
          c.cover ??= x.cover
          c.title ||= x.primary
          c.kind = bggKind(x.type)
        }
      } catch (e) {
        errors.bgg = (e as Error).message
      }
    }
  }

  if (book) {
    out.push({
      source: 'openlibrary',
      id: code,
      family: 'jdr',
      title: book.title,
      alt: book.subtitle,
      year: book.year,
      thumb: book.cover_thumb,
      cover: book.cover_url,
      platforms: [],
      info: [book.authors[0], book.publishers[0]].filter(Boolean).join(' · ') || 'Livre (ISBN)',
      kind: 'base',
      exact: true,
    })
  }

  // Rien de vérifié : on demande le nom du produit, puis on cherche ce titre.
  let product: BarcodeResult['product'] = null
  if (withProduct && !out.some((c) => c.exact)) {
    const p = await upcItemDb(code).catch((e) => {
      errors.upcitemdb = (e as Error).message
      return null
    })
    if (p) {
      const { title, platform } = cleanProductTitle(p.title)
      product = { title: p.title, query: title, platform, image: p.image }
      const boardgame = /board game|jeu de soci|card game|toys/i.test(p.category ?? '')
      const jobs: Promise<Candidate[]>[] = []
      if (!boardgame && env('TWITCH_CLIENT_ID')) jobs.push(igdbSearch(title).catch((e) => ((errors.igdb = e.message), [])))
      if ((boardgame || !env('TWITCH_CLIENT_ID')) && env('BGG_TOKEN')) jobs.push(bggSearch(title, 'jds').catch((e) => ((errors.bgg = e.message), [])))
      for (const list of await Promise.all(jobs)) out.push(...list.slice(0, 10))
    }
  }
  return { candidates: out, product }
}

// ---------------------------------------------------------------- Aiguillage

async function search(q: string, families: Family[], errors: Record<string, string>): Promise<Candidate[]> {
  const jobs: [string, Promise<Candidate[]>][] = []
  if (families.includes('jds')) jobs.push(['bgg', bggSearch(q, 'jds')])
  if (families.includes('jv')) jobs.push(['igdb', igdbSearch(q)])
  if (families.includes('jdr')) {
    jobs.push(['rpggeek', bggSearch(q, 'jdr')])
    jobs.push(['openlibrary', olSearch(q)])
  }
  const lists = await Promise.all(
    jobs.map(([name, p]) =>
      p.catch((e) => {
        errors[name] = (e as Error).message
        return [] as Candidate[]
      }),
    ),
  )
  return lists.flat()
}

async function details(source: string, id: string): Promise<Draft> {
  if (source === 'bgg') return await bggDetails(id)
  if (source === 'igdb') return await igdbDetails(id)
  if (source === 'openlibrary') return await olDetails(id)
  throw new SourceError('Source inconnue')
}

async function ping(check: boolean) {
  const sources = {
    bgg: Boolean(env('BGG_TOKEN')),
    igdb: Boolean(env('TWITCH_CLIENT_ID') && env('TWITCH_CLIENT_SECRET')),
    gameupc: true,
    upcitemdb: true,
    openlibrary: true,
  }
  const checks: Record<string, string> = {}
  if (check) {
    await Promise.all([
      sources.bgg ? bgg('search?query=catan&type=boardgame').then(() => (checks.bgg = 'ok'), (e) => (checks.bgg = e.message)) : null,
      sources.igdb ? twitchToken(true).then(() => (checks.igdb = 'ok'), (e) => (checks.igdb = e.message)) : null,
    ])
  }
  return { sources, checks, version: 2 }
}

// ---------------------------------------------------------------- HTTP

const ALLOWED = (env('ALLOWED_ORIGINS') || 'https://garcimore69.github.io,http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const authOk = new Map<string, number>()

/** Vérifie que l'appel vient d'un compte connecté (inscriptions fermées : c'est toi). */
async function authorized(req: Request): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token.startsWith('sb_')) return false
  const until = authOk.get(token)
  if (until && until > Date.now()) return true
  const url = env('SUPABASE_URL')
  const apikey = req.headers.get('apikey') || env('SUPABASE_ANON_KEY')
  if (!url || !apikey) return false
  const res = await http(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey } }, 6000)
  if (!res.ok) return false
  authOk.set(token, Date.now() + 10 * 60e3)
  return true
}

export async function handle(req: Request): Promise<Response> {
  const headers = { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return reply({ error: 'Méthode non autorisée' }, 405)

  try {
    if (!(await authorized(req))) return reply({ error: 'Connexion requise' }, 401)
    const body = await req.json().catch(() => ({}))
    const errors: Record<string, string> = {}
    switch (body.action) {
      case 'ping':
        return reply(await ping(Boolean(body.check)))
      case 'search': {
        const q = String(body.q ?? '').trim().slice(0, 120)
        if (q.length < 2) return reply({ results: [], errors })
        const fams = (Array.isArray(body.families) ? body.families : ['jds', 'jv', 'jdr']).filter((f: string) => ['jds', 'jv', 'jdr'].includes(f))
        return reply({ results: await search(q, fams, errors), errors })
      }
      case 'barcode': {
        const code = String(body.code ?? '').replace(/[^\dX]/gi, '').toUpperCase()
        if (!/^(\d{8}|\d{12,14}|\d{9}[\dX])$/.test(code)) return reply({ error: 'Code-barre invalide' }, 400)
        return reply({ ...(await barcode(code, errors, body.product !== false)), errors })
      }
      case 'details': {
        const draft = await details(String(body.source ?? ''), String(body.id ?? ''))
        return reply({ draft })
      }
      default:
        return reply({ error: 'Action inconnue' }, 400)
    }
  } catch (e) {
    const msg = e instanceof SourceError ? e.message : `Erreur serveur : ${(e as Error).message}`
    return reply({ error: msg }, e instanceof SourceError ? 502 : 500)
  }
}

if (g.Deno?.serve) g.Deno.serve(handle)
