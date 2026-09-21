import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/Items'
import { CandidateRow, SourceErrors, Thumb } from '../components/Online'
import { familyLong, localPlatforms } from '../lib/labels'
import { bestMatch, draftFromCandidate, fetchDetails, lookupBarcode, searchOnline, SOURCE_LABEL, type Candidate, type Draft } from '../lib/online'
import { back, go } from '../lib/router'
import { useStore } from '../lib/store'
import type { Game } from '../lib/types'

type FieldKind = 'text' | 'list' | 'num' | 'image' | 'long'
const FIELDS: [keyof Draft & keyof Game, string, FieldKind][] = [
  ['cover_url', 'Jaquette', 'image'],
  ['title', 'Titre', 'text'],
  ['original_title', 'Titre original', 'text'],
  ['subtitle', 'Sous-titre', 'text'],
  ['year', 'Année', 'num'],
  ['series', 'Gamme / univers', 'text'],
  ['publishers', 'Éditeurs', 'list'],
  ['developers', 'Développeurs', 'list'],
  ['authors', 'Auteurs', 'list'],
  ['illustrators', 'Illustrateurs', 'list'],
  ['genres', 'Genres', 'list'],
  ['mechanics', 'Mécanismes', 'list'],
  ['players_min', 'Joueurs min', 'num'],
  ['players_max', 'Joueurs max', 'num'],
  ['duration_min', 'Durée min', 'num'],
  ['duration_max', 'Durée max', 'num'],
  ['age_min', 'Âge minimum', 'num'],
  ['weight', 'Complexité', 'num'],
  ['community_rating', 'Note communauté', 'num'],
  ['isbn', 'ISBN', 'text'],
  ['description', 'Description', 'long'],
]

const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length)
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const show = (v: unknown, kind: FieldKind): ReactNode => {
  if (empty(v)) return <span className="muted">—</span>
  if (kind === 'list') return (v as string[]).join(', ')
  if (kind === 'num') return (v as number).toLocaleString('fr-FR')
  if (kind === 'long') return <span className="clamp3">{String(v)}</span>
  return String(v)
}

/** Compléter une fiche existante depuis BGG / IGDB / Open Library, champ par champ. */
export function CompletePage({ id }: { id: string }) {
  const { games, copies, ready, saveGame } = useStore()
  const game = games.get(id)
  const [q, setQ] = useState(game?.original_title || game?.title || '')
  const [results, setResults] = useState<Candidate[] | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ cand: Candidate; draft: Draft } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const myPlatforms = useMemo(() => [...new Set(copies.filter((c) => c.game_id === id && c.platform).map((c) => c.platform!))], [copies, id])

  const search = async (text: string) => {
    if (!game || text.trim().length < 2) return
    setLoading(true)
    setError(null)
    try {
      const code = game.barcodes[0]
      const [byTitle, byCode] = await Promise.all([
        searchOnline(text.trim(), [game.family]),
        code && game.family !== 'jv' ? lookupBarcode(code, false).catch(() => null) : Promise.resolve(null),
      ])
      const seen = new Set<string>()
      const all = [...(byCode?.candidates.filter((c) => c.exact) ?? []), ...byTitle.results].filter((c) => {
        const k = `${c.source}:${c.id}`
        if (seen.has(k) || c.family !== game.family) return false
        seen.add(k)
        return true
      })
      // Le résultat le plus probable en tête
      const best = bestMatch(game, all, myPlatforms, localPlatforms)
      setResults(best ? [best.cand, ...all.filter((c) => c !== best.cand)] : all)
      setErrors({ ...byTitle.errors, ...byCode?.errors })
    } catch (e) {
      setError((e as Error).message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (ready && game) search(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, game?.id])

  if (!game) {
    return !ready ? <p className="muted pad">Chargement…</p> : <EmptyState title="Jeu introuvable" text="Il a peut-être été supprimé." action={<a className="btn" href="#/">Retour</a>} />
  }

  const pick = async (c: Candidate) => {
    setBusy(`${c.source}:${c.id}`)
    setError(null)
    try {
      const draft = draftFromCandidate(await fetchDetails(c.source, c.id), c)
      const init: Record<string, boolean> = {}
      for (const [k] of FIELDS) {
        const nv = draft[k]
        if (!empty(nv) && !same(nv, game[k])) init[k] = empty(game[k])
      }
      setChecked(init)
      setPicked({ cand: c, draft })
      window.scrollTo(0, 0)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const apply = async () => {
    if (!picked) return
    const { draft } = picked
    const patch: Partial<Game> = { ext_ids: { ...game.ext_ids, [draft.source]: draft.external_id } }
    for (const [k, on] of Object.entries(checked)) if (on) (patch as Record<string, unknown>)[k] = draft[k as keyof Draft]
    if (checked.cover_url) patch.cover_thumb = draft.cover_thumb
    setSaving(true)
    try {
      await saveGame(game.id, patch)
      go(`/jeu/${game.id}`, true)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    search(q)
  }

  const diff = picked ? FIELDS.filter(([k]) => k in checked) : []
  const nChecked = Object.values(checked).filter(Boolean).length

  return (
    <div className="complete">
      <div className="edit-top">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={() => (picked ? setPicked(null) : back(`/jeu/${id}`))}>
          <Icon name={picked ? 'back' : 'close'} size={22} />
        </button>
        <div className="grow">
          <h1>Compléter depuis internet</h1>
          <p className="muted">
            {game.title} · {familyLong[game.family]}
            {myPlatforms.length ? ` · ${myPlatforms.join(', ')}` : ''}
          </p>
        </div>
        {picked && (
          <button type="button" className="btn primary" disabled={saving || !nChecked} onClick={apply}>
            {saving ? 'Enregistrement…' : `Appliquer (${nChecked})`}
          </button>
        )}
      </div>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {picked ? (
        <section className="block">
          <div className="block-head">
            <h2>
              {picked.cand.title} <span className="muted small">· {SOURCE_LABEL[picked.draft.source]}</span>
            </h2>
            <button type="button" className="link-btn" onClick={() => setPicked(null)}>
              Autre résultat
            </button>
          </div>
          {diff.length === 0 ? (
            <p className="muted">Cette fiche n’apporte rien de nouveau. Le lien avec {SOURCE_LABEL[picked.draft.source]} sera quand même mémorisé.</p>
          ) : (
            <>
              <p className="muted small">Coché par défaut : ce qui est vide dans ta fiche. Les champs déjà remplis ne sont remplacés que si tu les coches.</p>
              <div className="diff">
                {diff.map(([k, label, kind]) => (
                  <label key={k} className={checked[k] ? 'diff-row on' : 'diff-row'}>
                    <input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked({ ...checked, [k]: e.target.checked })} />
                    <span className="diff-label">{label}</span>
                    {kind === 'image' ? (
                      <span className="diff-imgs">
                        {game.cover_url ? <Thumb src={game.cover_thumb ?? game.cover_url} family={game.family} title="" /> : <span className="muted">aucune</span>}
                        <Icon name="back" size={16} className="flip" />
                        <Thumb src={picked.draft.cover_thumb ?? picked.draft.cover_url} family={game.family} title="" />
                      </span>
                    ) : (
                      <span className="diff-vals">
                        <span className="diff-old">{show(game[k], kind)}</span>
                        <span className="diff-new">{show(picked.draft[k], kind)}</span>
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
          {diff.length === 0 && (
            <button type="button" className="btn primary" disabled={saving} onClick={apply}>
              Mémoriser le lien
            </button>
          )}
        </section>
      ) : (
        <>
          <form className="searchbox wide" role="search" onSubmit={submit}>
            <Icon name="search" />
            <label className="sr" htmlFor="cq">
              Titre à chercher
            </label>
            <input id="cq" type="search" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="btn small">
              Chercher
            </button>
          </form>
          {loading && <p className="muted pad">Recherche…</p>}
          {results && !loading && !results.length && <p className="muted pad">Aucun résultat. Essaie le titre original ou un titre plus court.</p>}
          {results && results.length > 0 && (
            <div className="list">
              {results.map((c) => (
                <CandidateRow key={`${c.source}:${c.id}`} c={c} onChoose={pick} busy={busy === `${c.source}:${c.id}`} />
              ))}
            </div>
          )}
          <SourceErrors errors={errors} />
        </>
      )}
    </div>
  )
}
