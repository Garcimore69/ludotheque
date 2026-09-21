import { createClient } from '@supabase/supabase-js'

// Valeurs publiques, injectées au moment de la publication
// (GitHub > Settings > Secrets and variables > Actions > Variables).
// Aucune clé secrète ne doit jamais apparaître ici.
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? ''

// Tolère les petites erreurs de copier-coller : espaces, guillemets,
// barre finale ou suffixe /rest/v1 copié depuis l'interface Supabase.
const url = rawUrl
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '')
const key = rawKey.trim().replace(/^["']|["']$/g, '')

export const supabaseConfigured = Boolean(url && key)

export const supabase = supabaseConfigured ? createClient(url, key) : null

export type Diagnostic =
  | { etat: 'ok' }
  | { etat: 'absent'; manque: string[] }
  | { etat: 'erreur'; detail: string }

/** Vérifie que le projet Supabase répond, sans lire aucune donnée. */
export async function checkSupabase(): Promise<Diagnostic> {
  const manque = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter(
    Boolean,
  ) as string[]
  if (manque.length) return { etat: 'absent', manque }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    return { etat: 'erreur', detail: `URL inattendue : « ${url} » (attendu : https://xxxx.supabase.co)` }
  }
  if (!/^(sb_publishable_|eyJ)/.test(key)) {
    return { etat: 'erreur', detail: `clé inattendue, commence par « ${key.slice(0, 8)}… » (attendu : sb_publishable_…)` }
  }

  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    if (res.ok) return { etat: 'ok' }
    return { etat: 'erreur', detail: `réponse HTTP ${res.status} de ${new URL(url).host}` }
  } catch (e) {
    return { etat: 'erreur', detail: `serveur injoignable (${new URL(url).host}) : ${(e as Error).message}` }
  }
}
