import type { Condition, Copy, Family, Format, Game, Kind, PlayStatus, Region, Status } from './types'

export const FAMILIES: Family[] = ['jds', 'jv', 'jdr']

export const familyLabel: Record<Family, string> = { jds: 'Société', jv: 'Vidéo', jdr: 'Rôle' }
export const familyShort: Record<Family, string> = { jds: 'JdS', jv: 'JV', jdr: 'JdR' }
export const familyLong: Record<Family, string> = { jds: 'Jeu de société', jv: 'Jeu vidéo', jdr: 'Jeu de rôle' }

export const kindLabel: Record<Kind, string> = { base: 'Jeu de base', extension: 'Extension', standalone: 'Standalone' }

export const statusLabel: Record<Status, string> = {
  owned: 'Possédé',
  wishlist: 'Wishlist',
  loaned: 'Prêté',
  sold: 'Vendu / donné',
}

export const formatLabel: Record<Format, string> = {
  physique: 'Physique',
  demat: 'Dématérialisé',
  papier: 'Papier',
  pdf: 'PDF',
}

export const regionLabel: Record<Region, string> = { PAL: 'PAL', NTSC: 'NTSC (US)', 'NTSC-J': 'NTSC-J (Japon)', Autre: 'Autre' }

export const conditionLabel: Record<Condition, string> = {
  neuf: 'Neuf',
  tres_bon: 'Très bon état',
  bon: 'Bon état',
  moyen: 'État moyen',
  mauvais: 'Mauvais état',
}

export const playStatusLabel: Record<PlayStatus, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  fini: 'Fini',
  cent: '100 %',
}

export const RPG_BOOK_TYPES = ['Livre de base', 'Supplément', 'Scénario / campagne', 'Écran', 'Clanbook / guide', 'Autre']

export const PLATFORM_FAMILY: Record<string, string> = {
  'Super Nintendo': 'Nintendo',
  NES: 'Nintendo',
  'Nintendo DS': 'Nintendo',
  'Nintendo 3DS': 'Nintendo',
  'Nintendo Switch': 'Nintendo',
  'Nintendo Wii': 'Nintendo',
  'Nintendo Wii U': 'Nintendo',
  'Game Boy Advance': 'Nintendo',
  'Nintendo 64': 'Nintendo',
  GameCube: 'Nintendo',
  'PlayStation 2': 'Sony',
  'PlayStation 3': 'Sony',
  'PlayStation 4': 'Sony',
  'PlayStation 5': 'Sony',
  PlayStation: 'Sony',
  'PlayStation Vita': 'Sony',
  PSP: 'Sony',
  'Xbox 360': 'Microsoft',
  Xbox: 'Microsoft',
  'Xbox One': 'Microsoft',
  'Xbox Series': 'Microsoft',
  Dreamcast: 'Sega',
  'Master System': 'Sega',
  'Mega Drive': 'Sega',
  Saturn: 'Sega',
  PC: 'PC',
  Arcade: 'Arcade',
}

export function platformFamily(p: string | null): string {
  if (!p) return '—'
  return PLATFORM_FAMILY[p] ?? 'Autres'
}

/** Complétude d'un JV physique : Complet (boîte + notice + support), Loose, etc. */
export function completeness(c: Copy): string | null {
  if (c.format === 'demat') return 'Démat'
  if (c.has_box == null && c.has_manual == null) return null
  if (c.has_box && c.has_manual && c.has_media !== false) return 'Complet'
  if (c.has_box && !c.has_manual) return 'Sans notice'
  if (!c.has_box && c.has_manual) return 'Sans boîte'
  if (c.has_media === false) return 'Boîte seule'
  return 'Loose'
}

export function range(min: number | null, max: number | null, unit = ''): string | null {
  if (min == null && max == null) return null
  if (min != null && max == null) return `${min}+${unit}`
  if (min == null) return `≤ ${max}${unit}`
  if (min === max) return `${min}${unit}`
  return `${min}–${max}${unit}`
}

export function playersText(g: Game): string | null {
  const r = range(g.players_min, g.players_max)
  return r ? `${r} j` : null
}

export function durationText(g: Game): string | null {
  return range(g.duration_min, g.duration_max, ' min')
}

export function euro(v: number | null): string | null {
  if (v == null) return null
  return v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: v % 1 ? 2 : 0 })
}

export function dateFr(v: string | null): string | null {
  if (!v) return null
  const d = new Date(v.length === 10 ? v + 'T12:00:00' : v)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function rating(v: number | null): string | null {
  if (v == null) return null
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}/10`
}

/** Deux lignes d'info sous le titre, adaptées à la famille (comme dans les maquettes). */
export function cardLines(game: Game, copy: Copy): [string, string] {
  if (game.family === 'jv') {
    const l1 = [copy.platform, copy.region].filter(Boolean).join(' · ') || '—'
    const l2 =
      [
        copy.format === 'demat' ? 'Démat' : completeness(copy),
        copy.condition ? conditionLabel[copy.condition] : null,
        copy.play_status ? playStatusLabel[copy.play_status] : null,
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ') || '—'
    return [l1, l2]
  }
  const l1 = [game.year, game.publishers[0]].filter(Boolean).join(' · ') || '—'
  if (game.family === 'jdr') {
    return [l1, [game.rpg_system, game.rpg_book_type].filter(Boolean).join(' · ') || game.series || '—']
  }
  return [l1, [playersText(game), durationText(game)].filter(Boolean).join(' · ') || kindLabel[game.kind]]
}

/** Plateformes IGDB → noms utilisés dans la collection (repris de l'export Gamekult). */
const IGDB_PLATFORMS: Record<string, string> = {
  'Super Nintendo Entertainment System': 'Super Nintendo',
  'Super Famicom': 'Super Nintendo',
  'Nintendo Entertainment System': 'NES',
  'Family Computer': 'NES',
  'Family Computer Disk System': 'NES',
  Wii: 'Nintendo Wii',
  'Wii U': 'Nintendo Wii U',
  'Nintendo GameCube': 'GameCube',
  'PlayStation Portable': 'PSP',
  'Xbox Series X|S': 'Xbox Series',
  'Sega Mega Drive/Genesis': 'Mega Drive',
  'Sega Master System/Mark III': 'Master System',
  'Sega Saturn': 'Saturn',
  'Sega Game Gear': 'Game Gear',
  'PC (Microsoft Windows)': 'PC',
  DOS: 'PC',
  Mac: 'Mac',
  Linux: 'PC',
}

export function localPlatform(igdbName: string): string {
  return IGDB_PLATFORMS[igdbName] ?? igdbName
}

/** Plateformes d'une source, en noms de la collection, sans doublon. */
export function localPlatforms(names: string[]): string[] {
  return [...new Set(names.map(localPlatform))]
}

/** Plateforme devinée d'un intitulé commercial (« PS4 », « Switch »…) → nom de la collection. */
export function platformFromHint(hint: string | null | undefined): string | null {
  if (!hint) return null
  const h = hint.toLowerCase().replace(/\s+/g, ' ').trim()
  const ps = h.match(/^(?:ps|playstation) ?([1-5])$/)
  if (ps) return ps[1] === '1' ? 'PlayStation' : `PlayStation ${ps[1]}`
  const table: [RegExp, string][] = [
    [/vita/, 'PlayStation Vita'],
    [/^psp|portable/, 'PSP'],
    [/^playstation$/, 'PlayStation'],
    [/switch ?2/, 'Nintendo Switch 2'],
    [/switch/, 'Nintendo Switch'],
    [/xbox ?one/, 'Xbox One'],
    [/xbox ?360/, 'Xbox 360'],
    [/xbox ?series/, 'Xbox Series'],
    [/^xbox$/, 'Xbox'],
    [/wii ?u/, 'Nintendo Wii U'],
    [/wii/, 'Nintendo Wii'],
    [/3ds/, 'Nintendo 3DS'],
    [/^n?ds$|nintendo ds/, 'Nintendo DS'],
    [/gamecube|game cube/, 'GameCube'],
    [/advance|gba/, 'Game Boy Advance'],
    [/dreamcast/, 'Dreamcast'],
    [/^pc|dvd-?rom/, 'PC'],
  ]
  return table.find(([re]) => re.test(h))?.[1] ?? null
}
