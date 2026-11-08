import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Chip } from '../components/Controls'
import { Icon } from '../components/Icon'
import { Thumb } from '../components/Online'
import { computeTypes, GAME_TYPES, type GameType, type TypeResult } from '../lib/bggfr'
import { useLocalState } from '../lib/hooks'
import { localPlatforms } from '../lib/labels'
import { bestMatch, fetchRawDetails, lookupBarcode, searchOnline } from '../lib/online'
import { back } from '../lib/router'
import { useStore } from '../lib/store'
import type { Game } from '../lib/types'

interface Proposal {
  bgg: { id: string; title: string; thumb: string | null } | null
  linkSure: boolean
  sure: boolean // lien BGG sûr et types sans doute : applicable directement
  why: string
  result: TypeResult | null
  types: GameType[]
  state: 'found' | 'none' | 'error' | 'applied'
  checked: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Types devinés depuis les anciennes catégories MyLudo, quand BGG ne trouve rien. */
function fromMyLudo(g: Game): GameType[] {
  const all = [...g.genres, ...g.mechanics].map((s) => s.toLowerCase())
  const has = (re: RegExp) => all.some((s) => re.test(s))
  const t: GameType[] = []
  if (has(/plateau|pions|figurines/)) t.push('Plateau')
  else if (has(/dés/) && !has(/jet de dés/)) t.push('Dés')
  else if (has(/tuiles/)) t.push('Tuiles')
  else if (has(/cartes/)) t.push('Cartes')
  if (has(/ambiance/)) t.push('Ambiance')
  if (has(/escape|enquête|énigme/)) t.push('Enquête')
  if (has(/coopération/)) t.push('Coopératif')
  if (has(/solo/) || g.players_min === 1) t.push('Solo')
  return t
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Types de jeu : pour chaque jeu de société, retrouve sa fiche BGG, traduit catégories
 * et mécanismes, et en déduit des types courts (Plateau, Cartes, Coopératif…).
 */
export function TypesPage() {
  const { games, saveGame } = useStore()
  const [auto, setAuto] = useLocalState<boolean>('ludo-types-auto', () => true)
  const [done, setDone] = useLocalState<string[]>('ludo-types-done', () => [])
  const [ignored, setIgnored] = useLocalState<string[]>('ludo-types-ignored', () => [])
  const [props, setProps] = useState<Record<string, Proposal>>({})
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const stop = useRef(false)
  const doneRef = useRef<string[]>(done)

  const jds = useMemo(() => [...games.values()].filter((g) => g.family === 'jds'), [games])
  // Jeux de base d'abord : leurs extensions peuvent reprendre leurs types
  const todo = useMemo(
    () =>
      jds
        .filter((g) => !done.includes(g.id) && !ignored.includes(g.id) && !props[g.id])
        .sort((a, b) => Number(a.kind === 'extension') - Number(b.kind === 'extension') || a.title.localeCompare(b.title, 'fr')),
    [jds, done, ignored, props],
  )

  const markDone = (id: string) => {
    doneRef.current = [...new Set([...doneRef.current, id])]
    setDone(doneRef.current)
  }

  const findBgg = async (g: Game): Promise<{ id: string; title: string; thumb: string | null; sure: boolean; why: string } | null> => {
    if (g.ext_ids?.bgg) return { id: g.ext_ids.bgg, title: g.title, thumb: g.cover_thumb ?? null, sure: true, why: 'fiche BGG déjà liée' }
    for (const code of g.barcodes.slice(0, 2)) {
      const r = await lookupBarcode(code, false)
      const hit = r.candidates.find((c) => c.exact && c.source === 'bgg')
      if (hit) return { id: hit.id, title: hit.title, thumb: hit.thumb, sure: true, why: 'code-barre vérifié' }
    }
    const r = await searchOnline(g.original_title || g.title, ['jds'])
    let m = bestMatch(g, r.results, [], localPlatforms)
    if ((!m || !m.confident) && g.original_title && g.original_title !== g.title) {
      const m2 = bestMatch(g, (await searchOnline(g.title, ['jds'])).results, [], localPlatforms)
      if (m2 && (!m || m2.confident)) m = m2
    }
    if (!m) {
      const err = Object.values(r.errors)[0]
      if (err && !r.results.length) throw new Error(err)
      return null
    }
    return { id: m.cand.id, title: m.cand.title, thumb: m.cand.thumb, sure: m.confident, why: m.why }
  }

  const find = async (g: Game, known: Record<string, Proposal>): Promise<Proposal> => {
    const link = await findBgg(g)
    if (!link) {
      const t = fromMyLudo(g)
      return { bgg: null, linkSure: false, why: 'introuvable sur BGG : types devinés depuis MyLudo', result: null, types: t, state: 'none', checked: false, sure: false }
    }
    const d = await fetchRawDetails('bgg', link.id)
    const result = computeTypes({ categories: d.genres, mechanics: d.mechanics, title: d.title, players_min: d.players_min ?? g.players_min, previous: g.genres })
    let types = result.types
    let why = link.why
    // Extension peu renseignée : on reprend les types du jeu de base
    const base = g.base_game_id ? games.get(g.base_game_id) : null
    const baseTypes = base ? (known[base.id]?.types ?? (done.includes(base.id) ? (base.genres as GameType[]) : null)) : null
    if (g.kind === 'extension' && result.doubt && baseTypes?.length) {
      types = baseTypes
      result.doubt = null
      why = `${why} · types du jeu de base`
    }
    const sure = link.sure && !result.doubt
    return {
      bgg: { id: link.id, title: d.title || link.title, thumb: d.cover_thumb ?? link.thumb },
      linkSure: link.sure,
      why: result.doubt ? `${why} · ${result.doubt}` : why,
      result,
      types,
      state: 'found',
      sure,
      checked: link.sure, // pré-coché : un clic suffit pour valider la proposition
    }
  }

  const applyOne = async (g: Game, p: Proposal) => {
    const patch: Partial<Game> = { genres: p.types }
    if (p.result?.mechanics.length) patch.mechanics = p.result.mechanics
    if (p.result?.themes.length) patch.themes = p.result.themes
    if (p.bgg) patch.ext_ids = { ...g.ext_ids, bgg: p.bgg.id }
    await saveGame(g.id, patch)
    markDone(g.id)
  }

  const backup = () =>
    download(
      `sauvegarde-types-${new Date().toISOString().slice(0, 10)}.json`,
      jds.map((g) => ({ id: g.id, title: g.title, genres: g.genres, mechanics: g.mechanics, themes: g.themes, ext_ids: g.ext_ids ?? {} })),
    )

  const run = async () => {
    // Sauvegarde des valeurs actuelles avant le premier traitement
    if (!done.length && !Object.keys(props).length) backup()
    stop.current = false
    setRunning(true)
    setFatal(null)
    let failures = 0
    const known: Record<string, Proposal> = { ...props }
    for (const g of todo) {
      if (stop.current) break
      setCurrent(g.title)
      let p: Proposal
      try {
        p = await find(g, known)
        failures = 0
      } catch (e) {
        const msg = (e as Error).message
        p = { bgg: null, linkSure: false, why: msg, result: null, types: fromMyLudo(g), state: 'error', checked: false, sure: false }
        if (/non configuré|pas encore déployée|Connexion requise|injoignable|internet/.test(msg) || ++failures >= 5) {
          setFatal(msg)
          setProps((s) => ({ ...s, [g.id]: p }))
          break
        }
        await sleep(1500)
      }
      if (auto && p.sure && p.state === 'found') {
        try {
          await applyOne(g, p)
          p = { ...p, state: 'applied', checked: false }
        } catch (e) {
          p = { ...p, why: (e as Error).message }
        }
      }
      known[g.id] = p
      setProps((s) => ({ ...s, [g.id]: p }))
    }
    setCurrent(null)
    setRunning(false)
  }

  const applyChecked = async () => {
    setApplying(true)
    for (const [id, p] of Object.entries(props)) {
      const g = games.get(id)
      if (!g || !p.checked || p.state === 'applied' || !p.types.length) continue
      try {
        await applyOne(g, p)
        setProps((s) => ({ ...s, [id]: { ...p, state: 'applied', checked: false } }))
      } catch (e) {
        setProps((s) => ({ ...s, [id]: { ...p, why: (e as Error).message } }))
      }
    }
    setApplying(false)
  }

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const rows = JSON.parse(await file.text()) as { id: string; genres: string[]; mechanics: string[]; themes: string[]; ext_ids?: Record<string, string> }[]
      if (!Array.isArray(rows) || !window.confirm(`Remettre les types, mécanismes et thèmes de ${rows.length} jeux tels qu’ils étaient dans ce fichier ?`)) return
      setApplying(true)
      let n = 0
      for (const r of rows) {
        if (!games.get(r.id)) continue
        await saveGame(r.id, { genres: r.genres, mechanics: r.mechanics, themes: r.themes, ext_ids: r.ext_ids ?? {} })
        n++
      }
      doneRef.current = []
      setDone([])
      setProps({})
      setInfo(`${n} jeux restaurés.`)
    } catch (err) {
      setInfo(`Restauration impossible : ${(err as Error).message}`)
    } finally {
      setApplying(false)
    }
  }

  const setTypes = (id: string, p: Proposal, t: GameType) => {
    const types = p.types.includes(t) ? p.types.filter((x) => x !== t) : GAME_TYPES.filter((x) => x === t || p.types.includes(x))
    setProps((s) => ({ ...s, [id]: { ...p, types, checked: types.length > 0 } }))
  }

  const review = Object.entries(props)
    .map(([id, p]) => ({ g: games.get(id), p }))
    .filter((x): x is { g: Game; p: Proposal } => !!x.g && x.p.state !== 'applied' && !ignored.includes(x.g.id))
  const applied = Object.values(props).filter((p) => p.state === 'applied').length
  const nChecked = review.filter((x) => x.p.checked && x.p.types.length).length
  const total = Object.keys(props).length + todo.length

  return (
    <div className="covers">
      <div className="edit-top">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={() => back('/reglages')}>
          <Icon name="back" size={22} />
        </button>
        <div className="grow">
          <h1>Types de jeu</h1>
          <p className="muted">
            {jds.length} jeux de société · {done.length} déjà traités · {todo.length} à traiter
          </p>
        </div>
      </div>

      <section className="block">
        <p className="muted">
          Pour chaque jeu de société : fiche BGG (déjà liée, code-barre, puis titre), catégories et mécanismes traduits en français, puis types courts :{' '}
          {GAME_TYPES.join(', ')}. Les cas sûrs peuvent être appliqués directement ; les autres attendent ta validation ci-dessous, où tu peux corriger les
          types d’un clic. Une sauvegarde des valeurs actuelles est téléchargée au premier lancement.
        </p>
        <label className="check">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Appliquer directement les cas sûrs
        </label>
        <div className="btn-row">
          {running ? (
            <button type="button" className="btn" onClick={() => (stop.current = true)}>
              <Icon name="close" size={18} /> Arrêter
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={!todo.length || applying} onClick={run}>
              {Object.keys(props).length || done.length ? 'Continuer' : 'Lancer'} ({todo.length})
            </button>
          )}
          {!running && (
            <button type="button" className="btn ghost" onClick={backup}>
              Télécharger une sauvegarde
            </button>
          )}
          {!running && (
            <label className="btn ghost">
              Restaurer…
              <input type="file" accept="application/json,.json" hidden onChange={restore} />
            </label>
          )}
          {!running && (done.length > 0 || ignored.length > 0) && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (!window.confirm('Repasser tous les jeux de société dans le traitement ?')) return
                doneRef.current = []
                setDone([])
                setIgnored([])
                setProps({})
              }}
            >
              Tout retraiter
            </button>
          )}
        </div>
        {(running || applied > 0) && (
          <div className="progress" role="status">
            <div className="progress-bar">
              <span style={{ width: `${Math.round((Object.keys(props).length / Math.max(1, total)) * 100)}%` }} />
            </div>
            <span className="muted small">
              {Object.keys(props).length} traités · {applied} appliqué{applied > 1 ? 's' : ''}
              {current ? ` · ${current}…` : ''}
            </span>
          </div>
        )}
        {fatal && (
          <p className="alert" role="alert">
            Arrêt : {fatal}
          </p>
        )}
        {info && <p className="muted small">{info}</p>}
      </section>

      {review.length > 0 && (
        <section className="block">
          <div className="block-head">
            <h2>À valider · {review.length}</h2>
            <button type="button" className="btn primary small" disabled={!nChecked || applying} onClick={applyChecked}>
              {applying ? 'Enregistrement…' : `Appliquer la sélection (${nChecked})`}
            </button>
          </div>
          <div className="cover-grid">
            {review.map(({ g, p }) => (
              <article key={g.id} className={p.checked ? 'cover-tile on' : 'cover-tile'}>
                <label className="cover-tile-pick">
                  <input
                    type="checkbox"
                    checked={p.checked}
                    disabled={!p.types.length}
                    onChange={(e) => setProps((s) => ({ ...s, [g.id]: { ...p, checked: e.target.checked } }))}
                    aria-label={`Appliquer ces types à ${g.title}`}
                  />
                  <Thumb src={p.bgg?.thumb ?? g.cover_thumb ?? g.cover_url} family="jds" title={g.title} />
                </label>
                <div className="cover-tile-body">
                  <div className="row-title">{g.title}</div>
                  {p.bgg && (
                    <div className="row-meta small">
                      → BGG : {p.bgg.title}
                      {!p.linkSure && ' (à vérifier)'}
                    </div>
                  )}
                  <div className="small muted">Avant : {g.genres.join(', ') || '—'}</div>
                  <div className="chips">
                    {GAME_TYPES.map((t) => (
                      <Chip key={t} on={p.types.includes(t)} onClick={() => setTypes(g.id, p, t)}>
                        {t}
                      </Chip>
                    ))}
                  </div>
                  <div className={p.state === 'error' ? 'small danger-text' : 'small muted'}>{p.why}</div>
                  <div className="cover-tile-actions">
                    <a className="link-btn" href={`#/jeu/${g.id}/completer`}>
                      Autre fiche BGG
                    </a>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setIgnored([...ignored, g.id])
                      }}
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
