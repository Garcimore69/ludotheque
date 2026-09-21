import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Cover } from '../components/Cover'
import { Icon } from '../components/Icon'
import { EmptyState, FamilyBadge } from '../components/Items'
import {
  completeness,
  conditionLabel,
  dateFr,
  durationText,
  euro,
  familyLong,
  formatLabel,
  kindLabel,
  playersText,
  playStatusLabel,
  rating,
  regionLabel,
  statusLabel,
} from '../lib/labels'
import { back, go } from '../lib/router'
import { useStore } from '../lib/store'
import type { Copy, Game, PlayStatus } from '../lib/types'

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
  if (!shown.length) return null
  return (
    <dl className="facts">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

const join = (a: string[]) => (a.length ? a.join(', ') : null)
const yesNo = (b: boolean | null) => (b == null ? null : b ? 'Oui' : 'Non')

function CopyCard({ game, copy }: { game: Game; copy: Copy }) {
  const { saveCopy, setPhoto, clearPhoto } = useStore()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const title =
    game.family === 'jv'
      ? [copy.platform, copy.region, copy.edition].filter(Boolean).join(' · ') || 'Exemplaire'
      : [copy.edition, copy.language].filter(Boolean).join(' · ') || 'Exemplaire'

  return (
    <article className="copy">
      <div className="copy-head">
        <div className="copy-thumb">
          <Cover game={game} copy={copy} size="sm" />
        </div>
        <div className="grow">
          <h3>{title}</h3>
          <div className="copy-tags">
            <span className={`status-mark inline st-${copy.status}`}>{statusLabel[copy.status]}</span>
            {game.family === 'jv' && <span className="tag">{copy.format === 'demat' ? 'Démat' : completeness(copy) ?? 'Physique'}</span>}
            {copy.rating != null && <span className="tag strong">★ {rating(copy.rating)}</span>}
          </div>
        </div>
        <a className="icon-btn boxed" href={`#/exemplaire/${copy.id}`} aria-label="Modifier l’exemplaire">
          <Icon name="edit" size={18} />
        </a>
      </div>

      {game.family === 'jv' && copy.status !== 'wishlist' && (
        <div className="chips quick" role="group" aria-label="Statut de jeu">
          {(['a_faire', 'en_cours', 'fini', 'cent'] as PlayStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              className={copy.play_status === s ? 'chip on' : 'chip'}
              aria-pressed={copy.play_status === s}
              disabled={busy}
              onClick={() => run(() => saveCopy(copy.id, { play_status: copy.play_status === s ? null : s }))}
            >
              {playStatusLabel[s]}
            </button>
          ))}
        </div>
      )}

      <Facts
        rows={[
          ['Format', copy.format ? formatLabel[copy.format] : null],
          ['Boutique', copy.store],
          ['Région', copy.region ? regionLabel[copy.region] : null],
          ['Boîte', game.family === 'jv' && copy.format !== 'demat' ? yesNo(copy.has_box) : null],
          ['Notice', game.family === 'jv' && copy.format !== 'demat' ? yesNo(copy.has_manual) : null],
          ['Support', game.family === 'jv' && copy.format !== 'demat' ? yesNo(copy.has_media) : null],
          ['État', copy.condition ? conditionLabel[copy.condition] : null],
          ['Complet', game.family !== 'jv' ? yesNo(copy.complete) : null],
          ['Sleevé', game.family === 'jds' ? yesNo(copy.sleeved) : null],
          ['Langue', copy.language],
          ['Emplacement', copy.location],
          ['Dimensions', copy.dimensions ? `${copy.dimensions} cm` : null],
          ['Poids', copy.weight_g ? `${copy.weight_g >= 1000 ? (copy.weight_g / 1000).toLocaleString('fr-FR') + ' kg' : copy.weight_g + ' g'}` : null],
          ['Acquis le', dateFr(copy.acquired_on)],
          ['Prix payé', euro(copy.price_paid)],
          ['Lieu d’achat', copy.purchase_place],
          ['Valeur / cote', copy.value_estimate != null ? `${euro(copy.value_estimate)}${copy.value_date ? ` (au ${dateFr(copy.value_date)})` : ''}` : null],
          ['Dernière partie', dateFr(copy.last_played)],
          ['Ajouté le', dateFr(copy.added_at)],
          ['Tags', join(copy.tags)],
        ]}
      />
      {copy.comment && <p className="comment">{copy.comment}</p>}

      <div className="copy-actions">
        {copy.status === 'wishlist' && (
          <button
            type="button"
            className="btn primary small"
            disabled={busy}
            onClick={() => run(() => saveCopy(copy.id, { status: 'owned', acquired_on: new Date().toISOString().slice(0, 10) }))}
          >
            <Icon name="check" size={18} /> Je l’ai !
          </button>
        )}
        <button type="button" className="btn small" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={18} /> {copy.image_path ? 'Changer la photo' : 'Photo de mon exemplaire'}
        </button>
        {copy.image_path && (
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => run(() => clearPhoto(copy))}>
            Retirer la photo
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) run(() => setPhoto(copy, f))
          }}
        />
        {busy && <span className="muted small">Enregistrement…</span>}
      </div>
      {err && (
        <p className="alert" role="alert">
          {err}
        </p>
      )}
    </article>
  )
}

export function GamePage({ id }: { id: string }) {
  const { games, copies, ready } = useStore()
  const game = games.get(id)
  const heroRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-60px 0px 0px 0px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [game?.id])

  if (!game) {
    return !ready ? (
      <p className="muted pad">Chargement…</p>
    ) : (
      <EmptyState title="Jeu introuvable" text="Il a peut-être été supprimé." action={<a className="btn" href="#/">Retour à la collection</a>} />
    )
  }

  const mine = copies.filter((c) => c.game_id === game.id).sort((a, b) => a.added_at.localeCompare(b.added_at))
  const heroCopy = mine.find((c) => c.image_path) ?? mine[0] ?? null
  const base = game.base_game_id ? games.get(game.base_game_id) : null
  const children = [...games.values()].filter((g) => g.base_game_id === game.id).sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  const siblings = game.series && game.family === 'jdr' ? [...games.values()].filter((g) => g.series === game.series && g.id !== game.id && g.base_game_id !== game.id && g.id !== game.base_game_id) : []

  const catalogue: [string, ReactNode][] = [
    ['Type', `${familyLong[game.family]} · ${kindLabel[game.kind]}`],
    ['Année', game.year],
    ['Gamme', game.series],
    ['Système / édition', game.rpg_system],
    ['Type d’ouvrage', game.rpg_book_type],
    ['Joueurs', playersText(game)],
    ['Durée', durationText(game)],
    ['Âge', game.age_min != null ? `${game.age_min} ans et +` : null],
    ['Complexité', game.weight != null ? `${game.weight.toLocaleString('fr-FR')} / 5` : null],
    ['Développeur', join(game.developers)],
    ['Éditeur', join(game.publishers)],
    ['Auteurs', join(game.authors)],
    ['Illustrateurs', join(game.illustrators)],
    ['Genres', join(game.genres)],
    ['Mécanismes', join(game.mechanics)],
    ['Thèmes', join(game.themes)],
    ['Langues', join(game.languages)],
    ['Note communauté', game.community_rating != null ? rating(game.community_rating) : null],
    ['ISBN', game.isbn],
    ['Codes-barres', join(game.barcodes)],
    ['Source', game.source !== 'manuel' ? game.source : null],
  ]

  return (
    <div className={`gamepage fam-${game.family}`}>
      <div className={compact ? 'compact-bar show' : 'compact-bar'} aria-hidden={!compact}>
        <button type="button" className="icon-btn" aria-label="Retour" onClick={() => back('/')} tabIndex={compact ? 0 : -1}>
          <Icon name="back" size={22} />
        </button>
        <div className="compact-thumb">
          <Cover game={game} copy={heroCopy} size="sm" />
        </div>
        <span className="compact-title">{game.title}</span>
        <a className="icon-btn" href={`#/jeu/${game.id}/modifier`} aria-label="Modifier la fiche" tabIndex={compact ? 0 : -1}>
          <Icon name="edit" size={20} />
        </a>
      </div>

      <div className="game-top">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={() => back('/')}>
          <Icon name="back" size={22} />
        </button>
        <span className="grow" />
        <a className="btn small" href={`#/jeu/${game.id}/modifier`}>
          <Icon name="edit" size={18} /> Modifier
        </a>
      </div>

      <div className="game-layout">
        <div className="game-hero" ref={heroRef}>
          <div className={`hero-media fam-bg-${game.family}`}>
            <Cover game={game} copy={heroCopy} size="lg" />
          </div>
        </div>

        <div className="game-main">
          <div className="game-title">
            <div className="badges">
              <FamilyBadge family={game.family} />
              {game.kind !== 'base' && <span className="tag">{kindLabel[game.kind]}</span>}
            </div>
            <h1>{game.title}</h1>
            {game.subtitle && <p className="subtitle">{game.subtitle}</p>}
            {base && (
              <p className="muted">
                Extension de <a href={`#/jeu/${base.id}`}>{base.title}</a>
              </p>
            )}
          </div>

          <section className="block">
            <div className="block-head">
              <h2>Mes exemplaires</h2>
              <a className="btn small" href={`#/jeu/${game.id}/exemplaire`}>
                <Icon name="plus" size={18} /> Ajouter
              </a>
            </div>
            {mine.length ? mine.map((c) => <CopyCard key={c.id} game={game} copy={c} />) : <p className="muted">Aucun exemplaire.</p>}
          </section>

          {game.description && (
            <section className="block">
              <h2>Description</h2>
              <p className="prose">{game.description}</p>
            </section>
          )}

          <section className="block">
            <h2>Fiche</h2>
            <Facts rows={catalogue} />
          </section>

          {children.length > 0 && (
            <section className="block">
              <h2>{game.family === 'jdr' ? 'Suppléments' : 'Extensions'} · {children.length}</h2>
              <ul className="links">
                {children.map((g) => (
                  <li key={g.id}>
                    <a href={`#/jeu/${g.id}`}>{g.title}</a>
                    {g.year && <span className="muted"> · {g.year}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {siblings.length > 0 && (
            <section className="block">
              <h2>Même gamme · {siblings.length}</h2>
              <ul className="links">
                {siblings.map((g) => (
                  <li key={g.id}>
                    <a href={`#/jeu/${g.id}`}>{g.title}</a>
                    {g.rpg_book_type && <span className="muted"> · {g.rpg_book_type}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="danger-zone">
            <DeleteGame game={game} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteGame({ game }: { game: Game }) {
  const { removeGame } = useStore()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="btn ghost danger small"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Supprimer « ${game.title} » et tous ses exemplaires ? Cette action est définitive.`)) return
        setBusy(true)
        try {
          await removeGame(game.id)
          go('/', true)
        } catch (e) {
          window.alert((e as Error).message)
          setBusy(false)
        }
      }}
    >
      <Icon name="trash" size={18} /> Supprimer ce jeu
    </button>
  )
}
