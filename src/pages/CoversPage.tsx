import { useMemo, useRef, useState } from 'react'
import { Chip } from '../components/Controls'
import { Icon } from '../components/Icon'
import { FamilyBadge } from '../components/Items'
import { Thumb } from '../components/Online'
import { useLocalState } from '../lib/hooks'
import { FAMILIES, familyLabel, localPlatforms } from '../lib/labels'
import { bestMatch, fetchDetails, lookupBarcode, searchOnline, SOURCE_LABEL, type Candidate } from '../lib/online'
import { back } from '../lib/router'
import { useStore } from '../lib/store'
import type { Family, Game } from '../lib/types'

interface Proposal {
  cand: Candidate | null
  confident: boolean
  why: string
  state: 'found' | 'none' | 'error' | 'applied'
  checked: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Jaquettes automatiques : pour chaque jeu sans image, cherche la fiche en ligne
 * (identifiant déjà connu, code-barre vérifié, puis titre + plateforme) et propose la jaquette.
 */
export function CoversPage() {
  const { games, copies, saveGame } = useStore()
  const [fams, setFams] = useLocalState<Family[]>('ludo-covers-fams', () => [...FAMILIES])
  const [auto, setAuto] = useLocalState<boolean>('ludo-covers-auto', () => true)
  const [ignored, setIgnored] = useLocalState<string[]>('ludo-covers-ignored', () => [])
  const [props, setProps] = useState<Record<string, Proposal>>({})
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const stop = useRef(false)

  const platformsOf = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const c of copies) if (c.platform) m.set(c.game_id, [...new Set([...(m.get(c.game_id) ?? []), c.platform])])
    return m
  }, [copies])

  const missing = useMemo(
    () => [...games.values()].filter((g) => !g.cover_url && !ignored.includes(g.id)).sort((a, b) => a.title.localeCompare(b.title, 'fr')),
    [games, ignored],
  )
  const counts = useMemo(() => {
    const c: Record<string, number> = { jds: 0, jv: 0, jdr: 0 }
    for (const g of missing) c[g.family]++
    return c
  }, [missing])
  const todo = missing.filter((g) => fams.includes(g.family) && !props[g.id])

  const find = async (g: Game): Promise<Proposal> => {
    const mine = platformsOf.get(g.id) ?? []
    // 1. Identifiant déjà connu
    const known = Object.entries(g.ext_ids ?? {})[0]
    if (known) {
      const d = await fetchDetails(known[0] as Candidate['source'], known[1])
      if (d.cover_url) {
        const cand: Candidate = { source: d.source, id: d.external_id, family: g.family, title: d.title, alt: null, year: d.year, thumb: d.cover_thumb, cover: d.cover_url, platforms: d.platforms, info: null, kind: d.kind, exact: true }
        return { cand, confident: true, why: 'fiche déjà liée', state: 'found', checked: true }
      }
    }
    // 2. Code-barre vérifié (JdS via GameUPC, livres via ISBN)
    if (g.family !== 'jv') {
      for (const code of [...g.barcodes, g.isbn].filter(Boolean).slice(0, 2) as string[]) {
        const r = await lookupBarcode(code, false)
        const hit = r.candidates.find((c) => c.exact && (c.cover || c.thumb))
        if (hit) return { cand: { ...hit, family: g.family }, confident: true, why: 'code-barre vérifié', state: 'found', checked: true }
      }
    }
    // 3. Titre (+ plateforme pour un JV)
    const r = await searchOnline(g.original_title || g.title, [g.family])
    let m = bestMatch(g, r.results, mine, localPlatforms)
    if ((!m || !m.confident) && g.original_title && g.original_title !== g.title) {
      const r2 = await searchOnline(g.title, [g.family])
      const m2 = bestMatch(g, r2.results, mine, localPlatforms)
      if (m2 && (!m || m2.confident)) m = m2
    }
    if (!m) {
      const err = Object.values(r.errors)[0]
      if (err && !r.results.length) throw new Error(err)
      return { cand: null, confident: false, why: 'aucun résultat', state: 'none', checked: false }
    }
    return { cand: m.cand, confident: m.confident, why: m.why, state: 'found', checked: m.confident }
  }

  const applyOne = async (g: Game, p: Proposal) => {
    const c = p.cand!
    await saveGame(g.id, {
      cover_url: c.cover ?? c.thumb,
      cover_thumb: c.thumb ?? c.cover,
      ext_ids: { ...g.ext_ids, [c.source]: c.id },
    })
  }

  const run = async () => {
    stop.current = false
    setRunning(true)
    setFatal(null)
    let failures = 0
    for (const g of todo) {
      if (stop.current) break
      setCurrent(g.title)
      let p: Proposal
      try {
        p = await find(g)
        failures = 0
      } catch (e) {
        const msg = (e as Error).message
        p = { cand: null, confident: false, why: msg, state: 'error', checked: false }
        // Source non configurée ou fonction absente : inutile d'insister
        if (/non configuré|pas encore déployée|Connexion requise|injoignable|internet/.test(msg) || ++failures >= 5) {
          setFatal(msg)
          setProps((s) => ({ ...s, [g.id]: p }))
          break
        }
        await sleep(1500)
      }
      if (auto && p.confident && p.cand) {
        try {
          await applyOne(g, p)
          p = { ...p, state: 'applied', checked: false }
        } catch (e) {
          p = { ...p, why: (e as Error).message }
        }
      }
      setProps((s) => ({ ...s, [g.id]: p }))
    }
    setCurrent(null)
    setRunning(false)
  }

  const applyChecked = async () => {
    setApplying(true)
    for (const [id, p] of Object.entries(props)) {
      const g = games.get(id)
      if (!g || !p.checked || !p.cand || p.state !== 'found') continue
      try {
        await applyOne(g, p)
        setProps((s) => ({ ...s, [id]: { ...p, state: 'applied', checked: false } }))
      } catch (e) {
        setProps((s) => ({ ...s, [id]: { ...p, why: (e as Error).message } }))
      }
    }
    setApplying(false)
  }

  const review = Object.entries(props)
    .map(([id, p]) => ({ g: games.get(id), p }))
    .filter((x): x is { g: Game; p: Proposal } => !!x.g && x.p.state !== 'applied' && !ignored.includes(x.g.id))
  const applied = Object.values(props).filter((p) => p.state === 'applied').length
  const nChecked = review.filter((x) => x.p.checked && x.p.cand).length

  return (
    <div className="covers">
      <div className="edit-top">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={() => back('/reglages')}>
          <Icon name="back" size={22} />
        </button>
        <div className="grow">
          <h1>Jaquettes automatiques</h1>
          <p className="muted">
            {missing.length} jeu{missing.length > 1 ? 'x' : ''} sans jaquette · {counts.jds} JdS, {counts.jv} JV, {counts.jdr} JdR
          </p>
        </div>
      </div>

      <section className="block">
        <p className="muted">
          Pour chaque jeu sans image : fiche déjà liée, puis code-barre vérifié, puis titre (et plateforme pour les jeux vidéo). Les correspondances sûres
          peuvent être appliquées directement ; les autres attendent ta validation ci-dessous. Tes photos d’exemplaires restent prioritaires à l’affichage.
        </p>
        <div className="chips">
          {FAMILIES.map((f) => (
            <Chip key={f} on={fams.includes(f)} count={counts[f]} onClick={() => setFams(fams.includes(f) ? fams.filter((x) => x !== f) : [...fams, f])}>
              {familyLabel[f]}
            </Chip>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Appliquer directement les correspondances sûres
        </label>
        <div className="btn-row">
          {running ? (
            <button type="button" className="btn" onClick={() => (stop.current = true)}>
              <Icon name="close" size={18} /> Arrêter
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={!todo.length} onClick={run}>
              <Icon name="image" size={18} /> {Object.keys(props).length ? 'Continuer' : 'Lancer'} ({todo.length})
            </button>
          )}
          {ignored.length > 0 && !running && (
            <button type="button" className="btn ghost" onClick={() => setIgnored([])}>
              Réintégrer les {ignored.length} ignorés
            </button>
          )}
        </div>
        {(running || applied > 0) && (
          <div className="progress" role="status">
            <div className="progress-bar">
              <span style={{ width: `${Math.round((Object.keys(props).length / Math.max(1, Object.keys(props).length + todo.length)) * 100)}%` }} />
            </div>
            <span className="muted small">
              {Object.keys(props).length} traités · {applied} jaquette{applied > 1 ? 's' : ''} ajoutée{applied > 1 ? 's' : ''}
              {current ? ` · ${current}…` : ''}
            </span>
          </div>
        )}
        {fatal && (
          <p className="alert" role="alert">
            Arrêt : {fatal}
          </p>
        )}
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
                  {p.cand ? (
                    <>
                      <input
                        type="checkbox"
                        checked={p.checked}
                        onChange={(e) => setProps((s) => ({ ...s, [g.id]: { ...p, checked: e.target.checked } }))}
                        aria-label={`Utiliser cette jaquette pour ${g.title}`}
                      />
                      <Thumb src={p.cand.thumb ?? p.cand.cover} family={g.family} title={p.cand.title} />
                    </>
                  ) : (
                    <div className={`cover cover-sm fam-bg-${g.family}`} aria-hidden="true">
                      <span className="cover-title">?</span>
                    </div>
                  )}
                </label>
                <div className="cover-tile-body">
                  <div className="row-title">{g.title}</div>
                  <div className="row-meta">
                    <FamilyBadge family={g.family} />
                    <span className="muted clamp1">{(platformsOf.get(g.id) ?? []).join(', ') || g.year || ''}</span>
                  </div>
                  {p.cand && (
                    <div className="row-meta small">
                      → {p.cand.title}
                      {p.cand.year ? ` (${p.cand.year})` : ''} · {SOURCE_LABEL[p.cand.source]}
                    </div>
                  )}
                  <div className={p.state === 'error' ? 'small danger-text' : 'small muted'}>{p.why}</div>
                  <div className="cover-tile-actions">
                    <a className="link-btn" href={`#/jeu/${g.id}/completer`}>
                      Autre choix
                    </a>
                    <button type="button" className="link-btn" onClick={() => setIgnored([...ignored, g.id])}>
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
