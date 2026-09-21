import { supabase } from './supabase'
import type { Copy, CopyInput, Game, GameInput } from './types'

function db() {
  if (!supabase) throw new Error('Supabase n’est pas configuré')
  return supabase
}

const PAGE = 1000

/** Lit toute une table, par pages de 1000 lignes (limite par défaut de Supabase). */
async function fetchAll<T>(table: 'games' | 'copies'): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data as T[]))
    if (!data || data.length < PAGE) return out
  }
}

export async function loadCollection(): Promise<{ games: Game[]; copies: Copy[] }> {
  const [games, copies] = await Promise.all([fetchAll<Game>('games'), fetchAll<Copy>('copies')])
  return { games, copies }
}

export async function insertGame(input: GameInput): Promise<Game> {
  const { data, error } = await db().from('games').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data as Game
}

export async function updateGame(id: string, patch: Partial<Game>): Promise<Game> {
  const { data, error } = await db().from('games').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Game
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await db().from('games').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function insertCopy(input: CopyInput & { game_id: string }): Promise<Copy> {
  const { data, error } = await db().from('copies').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data as Copy
}

export async function updateCopy(id: string, patch: Partial<Copy>): Promise<Copy> {
  const { data, error } = await db().from('copies').update(patch).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Copy
}

export async function deleteCopy(id: string): Promise<void> {
  const { error } = await db().from('copies').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ------------------------------------------------------------------ Photos

const BUCKET = 'photos'

export async function uploadPhoto(userId: string, copyId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${copyId}-${Date.now()}.jpg`
  const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error(error.message)
  return path
}

export async function removePhoto(path: string): Promise<void> {
  await db().storage.from(BUCKET).remove([path])
}

/** URL temporaires (12 h) pour afficher des photos du bucket privé. */
export async function signPhotos(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await db().storage.from(BUCKET).createSignedUrls(paths, 12 * 3600)
  if (error) throw new Error(error.message)
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.signedUrl && d.path) out[d.path] = d.signedUrl
  return out
}
