export type Family = 'jds' | 'jv' | 'jdr'
export type Kind = 'base' | 'extension' | 'standalone'
export type Status = 'owned' | 'wishlist' | 'loaned' | 'sold'
export type Format = 'physique' | 'demat' | 'papier' | 'pdf'
export type Region = 'PAL' | 'NTSC' | 'NTSC-J' | 'Autre'
export type Condition = 'neuf' | 'tres_bon' | 'bon' | 'moyen' | 'mauvais'
export type PlayStatus = 'a_faire' | 'en_cours' | 'fini' | 'cent'

/** Fiche jeu : données catalogue. */
export interface Game {
  id: string
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
  cover_thumb?: string | null // lot 2 (absent des caches antérieurs)
  ext_ids?: Record<string, string> // lot 2 : { bgg: '432', igdb: '1234', openlibrary: '978…' }
  barcodes: string[]
  players_min: number | null
  players_max: number | null
  duration_min: number | null
  duration_max: number | null
  age_min: number | null
  weight: number | null
  rpg_system: string | null
  rpg_book_type: string | null
  isbn: string | null
  community_rating: number | null
  base_game_id: string | null
  source: string
  external_id: string | null
  created_at: string
  updated_at: string
}

/** Exemplaire : ce que je possède. */
export interface Copy {
  id: string
  game_id: string
  status: Status
  image_path: string | null
  added_at: string
  acquired_on: string | null
  price_paid: number | null
  purchase_place: string | null
  value_estimate: number | null
  value_date: string | null
  rating: number | null
  comment: string | null
  tags: string[]
  language: string | null
  edition: string | null
  location: string | null
  last_played: string | null
  dimensions: string | null
  weight_g: number | null
  sleeved: boolean | null
  complete: boolean | null
  platform: string | null
  store: string | null
  format: Format | null
  region: Region | null
  has_box: boolean | null
  has_manual: boolean | null
  has_media: boolean | null
  condition: Condition | null
  play_status: PlayStatus | null
  created_at: string
  updated_at: string
}

/** Un élément affiché dans la collection : un exemplaire et sa fiche. */
export interface Item {
  copy: Copy
  game: Game
}

export type GameInput = Partial<Omit<Game, 'id' | 'created_at' | 'updated_at'>> & Pick<Game, 'family' | 'title'>
export type CopyInput = Partial<Omit<Copy, 'id' | 'created_at' | 'updated_at'>>
