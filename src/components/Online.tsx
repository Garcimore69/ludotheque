import { useState } from 'react'
import { kindLabel } from '../lib/labels'
import { draftFromCandidate, fetchDetails, gameForCandidate, setPending, SOURCE_LABEL, withBarcode, type Candidate } from '../lib/online'
import { go } from '../lib/router'
import { useStore } from '../lib/store'
import type { Game } from '../lib/types'
import { Cover, swatch } from './Cover'
import { Icon } from './Icon'
import { FamilyBadge } from './Items'

/** Vignette d'un résultat en ligne (image distante, sinon aplat de la famille). */
export function Thumb({ src, family, title }: { src: string | null; family: string; title: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`cover cover-sm fam-bg-${family}${src && !broken ? ' has-img' : ''}`} style={src && !broken ? undefined : { background: swatch(title) }} aria-hidden="true">
      {src && !broken ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <span className="cover-title">{title}</span>}
    </div>
  )
}

export interface ChooseContext {
  barcode?: string
  wishlist?: boolean
  platformHint?: string | null
}

/**
 * Choix d'un résultat en ligne :
 *  - déjà dans la collection → nouvel exemplaire (et code-barre mémorisé) ;
 *  - sinon → fiche complète depuis la source, puis formulaire pré-rempli.
 */
export function useChoose(ctx: ChooseContext) {
  const { games, saveGame } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (c: Candidate) => {
    const key = `${c.source}:${c.id}`
    setBusy(key)
    setError(null)
    try {
      const existing = gameForCandidate(games.values(), c.source, c.id)
      if (existing) {
        await rememberCode(existing)
        go(`/jeu/${existing.id}/exemplaire`)
        return
      }
      const draft = draftFromCandidate(await fetchDetails(c.source, c.id), c)
      setPending({ draft, barcode: ctx.barcode, wishlist: ctx.wishlist, platformHint: ctx.platformHint })
      go(`/ajout/manuel${ctx.wishlist ? '/wishlist' : ''}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  /** Mémorise le code scanné sur un jeu existant. */
  const rememberCode = async (g: Game) => {
    if (!ctx.barcode) return
    const next = withBarcode(g, ctx.barcode)
    if (next) await saveGame(g.id, { barcodes: next })
  }

  return { choose, busy, error, rememberCode }
}

export function CandidateRow({ c, onChoose, busy }: { c: Candidate; onChoose: (c: Candidate) => void; busy: boolean }) {
  const { games } = useStore()
  const mine = gameForCandidate(games.values(), c.source, c.id)
  const meta = [c.year, c.kind !== 'base' ? kindLabel[c.kind] : null].filter(Boolean).join(' · ')
  return (
    <button type="button" className="row cand" onClick={() => onChoose(c)} disabled={busy} aria-busy={busy}>
      <Thumb src={c.thumb} family={c.family} title={c.title} />
      <div className="row-main">
        <div className="row-title">{c.title}</div>
        <div className="row-meta">
          <FamilyBadge family={c.family} />
          {meta && <span>{meta}</span>}
          {c.alt && <span className="muted">{c.alt}</span>}
        </div>
        {c.info && <div className="row-meta muted clamp1">{c.info}</div>}
      </div>
      <div className="row-side">
        {busy ? (
          <span className="spinner" aria-label="Chargement" />
        ) : mine ? (
          <span className="tag ok">Dans ma collection</span>
        ) : c.exact ? (
          <span className="tag strong">Correspond</span>
        ) : null}
        <Icon name="plus" size={20} />
      </div>
    </button>
  )
}

/** Ligne d'un jeu de ma collection dans un écran de recherche. */
export function LocalRow({ game, action }: { game: Game; action?: { label: string; onClick: () => void } }) {
  const { copies } = useStore()
  const mine = copies.filter((c) => c.game_id === game.id)
  const hero = mine.find((c) => c.image_path) ?? mine[0] ?? null
  const plats = [...new Set(mine.map((c) => c.platform).filter(Boolean))].join(', ')
  return (
    <div className="row local">
      <a className="row-link" href={`#/jeu/${game.id}`}>
        <Cover game={game} copy={hero} size="sm" />
        <div className="row-main">
          <div className="row-title">{game.title}</div>
          <div className="row-meta">
            <FamilyBadge family={game.family} />
            <span>{plats || [game.year, game.publishers[0]].filter(Boolean).join(' · ') || '—'}</span>
          </div>
          <div className="row-meta muted">
            {mine.length} exemplaire{mine.length > 1 ? 's' : ''}
            {mine.some((c) => c.status === 'wishlist') ? ' · wishlist' : ''}
          </div>
        </div>
      </a>
      {action && (
        <button type="button" className="btn small" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

export function SourceErrors({ errors }: { errors: Record<string, string> }) {
  const list = Object.entries(errors)
  if (!list.length) return null
  return (
    <ul className="source-errors">
      {list.map(([k, v]) => (
        <li key={k}>
          <strong>{SOURCE_LABEL[k] ?? k}</strong> : {v}
        </li>
      ))}
    </ul>
  )
}
