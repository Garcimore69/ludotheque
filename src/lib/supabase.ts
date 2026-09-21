import { createClient } from '@supabase/supabase-js'

// Valeurs publiques, injectées au moment de la publication
// (GitHub > Settings > Secrets and variables > Actions > Variables).
// Aucune clé secrète ne doit jamais apparaître ici.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured ? createClient(url!, key!) : null

/** Vérifie que le projet Supabase répond, sans lire aucune donnée. */
export async function checkSupabase(): Promise<'ok' | 'absent' | 'erreur'> {
  if (!url || !key) return 'absent'
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } })
    return res.ok ? 'ok' : 'erreur'
  } catch {
    return 'erreur'
  }
}
