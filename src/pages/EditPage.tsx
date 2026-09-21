import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Chip } from '../components/Controls'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/Items'
import { Thumb } from '../components/Online'
import { conditionLabel, FAMILIES, familyLong, formatLabel, kindLabel, localPlatforms, platformFromHint, playStatusLabel, regionLabel, RPG_BOOK_TYPES, statusLabel } from '../lib/labels'
import { clearPending, draftToGame, peekPending, SOURCE_LABEL, type Pending } from '../lib/online'
import { back, go } from '../lib/router'
import { useStore } from '../lib/store'
import type { Copy, CopyInput, Family, Game, GameInput } from '../lib/types'

type FieldType = 'text' | 'int' | 'dec' | 'list' | 'textarea' | 'select' | 'bool' | 'date' | 'base'
interface FieldDef {
  key: string
  label: string
  type: FieldType
  families?: Family[]
  options?: [string, string][]
  placeholder?: string
  suggest?: boolean // propose les valeurs déjà saisies
  wide?: boolean
  required?: boolean
  hint?: string
}
interface SectionDef {
  title: string
  fields: FieldDef[]
  families?: Family[]
}

const opts = (rec: Record<string, string>): [string, string][] => Object.entries(rec)

const GAME_SECTIONS: SectionDef[] = [
  {
    title: 'Le jeu',
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true, wide: true },
      { key: 'subtitle', label: 'Sous-titre', type: 'text', wide: true },
      { key: 'kind', label: 'Nature', type: 'select', options: opts(kindLabel) },
      { key: 'year', label: 'Année de sortie', type: 'int', placeholder: 'ex. 2016' },
      { key: 'series', label: 'Gamme / univers', type: 'text', suggest: true },
      { key: 'base_game_id', label: 'Extension / supplément de', type: 'base' },
      { key: 'original_title', label: 'Titre original', type: 'text' },
      { key: 'publishers', label: 'Éditeurs', type: 'list', placeholder: 'séparés par des virgules' },
      { key: 'developers', label: 'Développeurs', type: 'list', families: ['jv'] },
      { key: 'authors', label: 'Auteurs', type: 'list', families: ['jds', 'jdr'] },
      { key: 'illustrators', label: 'Illustrateurs', type: 'list', families: ['jds', 'jdr'] },
      { key: 'genres', label: 'Genres / catégories', type: 'list' },
      { key: 'mechanics', label: 'Mécanismes', type: 'list', families: ['jds'] },
      { key: 'themes', label: 'Thèmes', type: 'list', families: ['jds'] },
      { key: 'languages', label: 'Langues disponibles', type: 'list' },
      { key: 'barcodes', label: 'Codes-barres (EAN)', type: 'list', placeholder: 'ex. 3421272101337' },
      { key: 'community_rating', label: 'Note communauté /10', type: 'dec' },
      { key: 'description', label: 'Description', type: 'textarea', wide: true },
      { key: 'cover_url', label: 'Jaquette (adresse de l’image)', type: 'text', wide: true, placeholder: 'https://…', hint: 'Remplie par la recherche en ligne ; la photo de ton exemplaire reste prioritaire.' },
    ],
  },
  {
    title: 'Pratique',
    families: ['jds'],
    fields: [
      { key: 'players_min', label: 'Joueurs min', type: 'int' },
      { key: 'players_max', label: 'Joueurs max', type: 'int', hint: 'vide = pas de maximum' },
      { key: 'duration_min', label: 'Durée min (min)', type: 'int' },
      { key: 'duration_max', label: 'Durée max (min)', type: 'int' },
      { key: 'age_min', label: 'Âge minimum', type: 'int' },
      { key: 'weight', label: 'Complexité (1 à 5)', type: 'dec' },
    ],
  },
  {
    title: 'Jeu de rôle',
    families: ['jdr'],
    fields: [
      { key: 'rpg_system', label: 'Système / édition', type: 'text', suggest: true, placeholder: 'ex. 20e anniversaire' },
      { key: 'rpg_book_type', label: 'Type d’ouvrage', type: 'select', options: RPG_BOOK_TYPES.map((t) => [t, t]) },
      { key: 'isbn', label: 'ISBN', type: 'text' },
    ],
  },
]

const COPY_SECTIONS: SectionDef[] = [
  {
    title: 'Mon exemplaire',
    fields: [
      { key: 'status', label: 'Statut', type: 'select', options: opts(statusLabel) },
      { key: 'play_status', label: 'Statut de jeu', type: 'select', options: opts(playStatusLabel), families: ['jv'] },
      { key: 'rating', label: 'Ma note /10', type: 'dec' },
      { key: 'tags', label: 'Tags', type: 'list', placeholder: 'ex. soirée, coop' },
      { key: 'comment', label: 'Commentaire', type: 'textarea', wide: true },
    ],
  },
  {
    title: 'Version',
    fields: [
      { key: 'platform', label: 'Plateforme', type: 'text', suggest: true, families: ['jv'], required: true },
      { key: 'format', label: 'Format', type: 'select', options: opts(formatLabel) },
      { key: 'store', label: 'Boutique démat', type: 'text', suggest: true, families: ['jv'], placeholder: 'ex. PlayStation Network' },
      { key: 'region', label: 'Région', type: 'select', options: opts(regionLabel), families: ['jv'] },
      { key: 'edition', label: 'Édition', type: 'text', placeholder: 'ex. Collector, 2e édition' },
      { key: 'language', label: 'Langue', type: 'text', suggest: true },
    ],
  },
  {
    title: 'Complétude et état',
    fields: [
      { key: 'has_box', label: 'Boîte', type: 'bool', families: ['jv'] },
      { key: 'has_manual', label: 'Notice', type: 'bool', families: ['jv'] },
      { key: 'has_media', label: 'Support (cartouche, disque)', type: 'bool', families: ['jv'] },
      { key: 'complete', label: 'Complet', type: 'bool', families: ['jds', 'jdr'] },
      { key: 'sleeved', label: 'Cartes sleevées', type: 'bool', families: ['jds'] },
      { key: 'condition', label: 'État', type: 'select', options: opts(conditionLabel) },
    ],
  },
  {
    title: 'Achat et valeur',
    fields: [
      { key: 'acquired_on', label: 'Date d’acquisition', type: 'date' },
      { key: 'price_paid', label: 'Prix payé (€)', type: 'dec' },
      { key: 'purchase_place', label: 'Lieu d’achat', type: 'text', suggest: true },
      { key: 'value_estimate', label: 'Valeur / cote (€)', type: 'dec' },
      { key: 'value_date', label: 'Date de la cote', type: 'date' },
    ],
  },
  {
    title: 'Rangement',
    fields: [
      { key: 'location', label: 'Emplacement', type: 'text', suggest: true, placeholder: 'ex. Kallax B3' },
      { key: 'dimensions', label: 'Dimensions (cm)', type: 'text', placeholder: 'L x l x h', families: ['jds', 'jdr'] },
      { key: 'weight_g', label: 'Poids (g)', type: 'int', families: ['jds', 'jdr'] },
      { key: 'last_played', label: 'Dernière partie', type: 'date' },
    ],
  },
]

type Values = Record<string, string | boolean | null>

function toValues(src: Record<string, unknown>, sections: SectionDef[]): Values {
  const v: Values = {}
  for (const s of sections)
    for (const f of s.fields) {
      const x = src[f.key]
      if (f.type === 'bool') v[f.key] = (x as boolean | null) ?? null
      else if (Array.isArray(x)) v[f.key] = x.join(', ')
      else if (f.type === 'date' && typeof x === 'string') v[f.key] = x.slice(0, 10)
      else v[f.key] = x == null ? '' : String(x)
    }
  return v
}

function fromValues(v: Values, sections: SectionDef[], family: Family): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const s of sections) {
    if (s.families && !s.families.includes(family)) continue
    for (const f of s.fields) {
      if (f.families && !f.families.includes(family)) continue
      const x = v[f.key]
      if (f.type === 'bool') out[f.key] = x
      else {
        const t = typeof x === 'string' ? x.trim() : ''
        if (f.type === 'list') out[f.key] = t ? t.split(',').map((y) => y.trim()).filter(Boolean) : []
        else if (f.type === 'int') out[f.key] = t ? Math.round(Number(t.replace(',', '.'))) : null
        else if (f.type === 'dec') out[f.key] = t ? Number(t.replace(',', '.')) : null
        else out[f.key] = t || null
      }
    }
  }
  return out
}

function validate(v: Values, family: Family): string | null {
  if (!String(v.title ?? '').trim()) return 'Le titre est obligatoire.'
  const num = (k: string) => {
    const t = String(v[k] ?? '').trim().replace(',', '.')
    return t ? Number(t) : null
  }
  for (const k of ['year', 'players_min', 'players_max', 'duration_min', 'duration_max', 'age_min', 'weight_g', 'rating', 'community_rating', 'price_paid', 'value_estimate', 'weight']) {
    if (k in v && num(k) != null && Number.isNaN(num(k))) return `Valeur non numérique : ${k}`
  }
  const r = num('rating')
  if (r != null && (r < 0 || r > 10)) return 'La note doit être entre 0 et 10.'
  const cr = num('community_rating')
  if (cr != null && (cr < 0 || cr > 10)) return 'La note communauté doit être entre 0 et 10.'
  const y = num('year')
  if (y != null && (y < 1900 || y > 2100)) return 'Année de sortie invalide.'
  if (family === 'jv' && 'platform' in v && !String(v.platform ?? '').trim()) return 'Indique la plateforme du jeu vidéo.'
  return null
}

function Form({
  sections,
  family,
  values,
  set,
  suggestions,
  bases,
}: {
  sections: SectionDef[]
  family: Family
  values: Values
  set: (k: string, v: string | boolean | null) => void
  suggestions: Record<string, string[]>
  bases: Game[]
}) {
  return (
    <>
      {sections
        .filter((s) => !s.families || s.families.includes(family))
        .map((s) => (
          <fieldset key={s.title} className="fset">
            <legend>{s.title}</legend>
            <div className="fgrid">
              {s.fields
                .filter((f) => !f.families || f.families.includes(family))
                .map((f) => {
                  const id = `f-${f.key}`
                  const val = values[f.key]
                  if (f.type === 'bool') {
                    return (
                      <div key={f.key} className="field">
                        <span className="field-label">{f.label}</span>
                        <div className="chips">
                          {([
                            [true, 'Oui'],
                            [false, 'Non'],
                            [null, '?'],
                          ] as [boolean | null, string][]).map(([b, l]) => (
                            <Chip key={l} on={val === b} onClick={() => set(f.key, b)}>
                              {l}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return (
                    <label key={f.key} className={f.wide || f.type === 'textarea' ? 'field wide' : 'field'} htmlFor={id}>
                      <span className="field-label">
                        {f.label}
                        {f.required && <span aria-hidden="true"> *</span>}
                      </span>
                      {f.type === 'textarea' ? (
                        <textarea id={id} className="input" rows={3} value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)} />
                      ) : f.type === 'select' ? (
                        <select id={id} className="input" value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                          {f.key !== 'status' && f.key !== 'kind' && <option value="">—</option>}
                          {f.options!.map(([k, l]) => (
                            <option key={k} value={k}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'base' ? (
                        <select id={id} className="input" value={String(val ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                          <option value="">— aucun —</option>
                          {bases.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          className="input"
                          type={f.type === 'date' ? 'date' : 'text'}
                          inputMode={f.type === 'int' ? 'numeric' : f.type === 'dec' ? 'decimal' : undefined}
                          placeholder={f.placeholder}
                          list={f.suggest ? `dl-${f.key}` : undefined}
                          required={f.required}
                          value={String(val ?? '')}
                          onChange={(e) => set(f.key, e.target.value)}
                        />
                      )}
                      {f.hint && <span className="muted small">{f.hint}</span>}
                      {f.suggest && (
                        <datalist id={`dl-${f.key}`}>
                          {(suggestions[f.key] ?? []).map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      )}
                    </label>
                  )
                })}
            </div>
          </fieldset>
        ))}
    </>
  )
}

export type EditMode =
  | { name: 'new'; wishlist: boolean }
  | { name: 'editGame'; id: string }
  | { name: 'newCopy'; gameId: string }
  | { name: 'editCopy'; id: string }

export function EditPage({ mode }: { mode: EditMode }) {
  const store = useStore()
  const { games, copies } = store

  const existingCopy: Copy | undefined = mode.name === 'editCopy' ? copies.find((c) => c.id === mode.id) : undefined
  const existingGame: Game | undefined =
    mode.name === 'editGame' ? games.get(mode.id) : mode.name === 'newCopy' ? games.get(mode.gameId) : existingCopy ? games.get(existingCopy.game_id) : undefined

  const withGame = mode.name === 'new' || mode.name === 'editGame'
  const withCopy = mode.name !== 'editGame'

  // Brouillon venu de la recherche en ligne ou du scan (formulaire d'ajout uniquement)
  const [pending] = useState<Pending>(() => (mode.name === 'new' ? peekPending() : {}))
  const draft = pending.draft
  useEffect(() => {
    if (mode.name === 'new') clearPending()
  }, [mode.name])
  const draftPlatforms = useMemo(() => (draft ? localPlatforms(draft.platforms) : []), [draft])

  const [family, setFamily] = useState<Family>(existingGame?.family ?? draft?.family ?? 'jds')
  const [useCover, setUseCover] = useState(true)
  const [values, setValues] = useState<Values>(() => {
    const src: Record<string, unknown> = draft ? draftToGame(draft, games.values()) : { kind: 'base' }
    if (pending.barcode) {
      const code = pending.barcode
      const list = (src.barcodes as string[] | undefined) ?? []
      src.barcodes = list.includes(code) ? list : [...list, code]
      if (!src.isbn && /^97[89]\d{10}$/.test(code) && (draft?.family ?? 'jds') === 'jdr') src.isbn = code
    }
    const g = existingGame ? toValues(existingGame as unknown as Record<string, unknown>, GAME_SECTIONS) : toValues(src, GAME_SECTIONS)
    const baseCopy: Record<string, unknown> =
      mode.name === 'editCopy' && existingCopy
        ? (existingCopy as unknown as Record<string, unknown>)
        : {
            status: mode.name === 'new' && mode.wishlist ? 'wishlist' : 'owned',
            platform:
              draftPlatforms.length === 1
                ? draftPlatforms[0]
                : (draftPlatforms.find((p) => p === platformFromHint(pending.platformHint)) ?? (draft ? null : platformFromHint(pending.platformHint))),
          }
    return { ...g, ...toValues(baseCopy, COPY_SECTIONS) }
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const suggestions = useMemo(() => {
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'fr'))
    const gs = [...games.values()]
    return {
      series: uniq(gs.map((g) => g.series)),
      rpg_system: uniq(gs.map((g) => g.rpg_system)),
      platform: [...draftPlatforms, ...uniq(copies.map((c) => c.platform)).filter((p) => !draftPlatforms.includes(p))],
      store: uniq(copies.map((c) => c.store)),
      language: uniq(copies.map((c) => c.language)),
      purchase_place: uniq(copies.map((c) => c.purchase_place)),
      location: uniq(copies.map((c) => c.location)),
    }
  }, [games, copies, draftPlatforms])

  const bases = useMemo(
    () =>
      [...games.values()]
        .filter((g) => g.family === family && g.kind !== 'extension' && g.id !== existingGame?.id)
        .sort((a, b) => a.title.localeCompare(b.title, 'fr')),
    [games, family, existingGame?.id],
  )

  if ((mode.name !== 'new' && !existingGame) || (mode.name === 'editCopy' && !existingCopy)) {
    return !store.ready ? <p className="muted pad">Chargement…</p> : <EmptyState title="Introuvable" text="Ce jeu ou cet exemplaire n’existe plus." action={<a className="btn" href="#/">Retour</a>} />
  }

  const set = (k: string, v: string | boolean | null) => setValues((old) => ({ ...old, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const checkValues = withGame ? values : { ...values, title: existingGame!.title }
    const problem = validate(withCopy ? checkValues : Object.fromEntries(Object.entries(checkValues).filter(([k]) => k !== 'platform')), family)
    if (problem) {
      setErr(problem)
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const g = fromValues(values, GAME_SECTIONS, family)
      const c = fromValues(values, COPY_SECTIONS, family)
      if (!c.format) c.format = family === 'jv' ? 'physique' : family === 'jdr' ? 'papier' : null
      if (mode.name === 'new') {
        if (draft) {
          g.ext_ids = { [draft.source]: draft.external_id }
          if (useCover && g.cover_url === draft.cover_url) g.cover_thumb = draft.cover_thumb
          if (!useCover) g.cover_url = null
        }
        const { game } = await store.createGameWithCopy({ ...(g as GameInput), family }, c as CopyInput)
        go(`/jeu/${game.id}`, true)
      } else if (mode.name === 'editGame') {
        if ((g.cover_url ?? null) !== (existingGame!.cover_url ?? null)) g.cover_thumb = null
        await store.saveGame(mode.id, { ...(g as Partial<Game>), family })
        go(`/jeu/${mode.id}`, true)
      } else if (mode.name === 'newCopy') {
        await store.addCopy({ ...(c as CopyInput), game_id: mode.gameId })
        go(`/jeu/${mode.gameId}`, true)
      } else {
        await store.saveCopy(mode.id, c as Partial<Copy>)
        go(`/jeu/${existingGame!.id}`, true)
      }
    } catch (e2) {
      setErr((e2 as Error).message)
      setBusy(false)
    }
  }

  const heading =
    mode.name === 'new'
      ? mode.wishlist
        ? 'Ajouter à la wishlist'
        : 'Ajouter un jeu'
      : mode.name === 'editGame'
        ? 'Modifier la fiche'
        : mode.name === 'newCopy'
          ? 'Nouvel exemplaire'
          : 'Modifier l’exemplaire'

  return (
    <form className="edit" onSubmit={submit} noValidate>
      <div className="edit-top">
        <button type="button" className="icon-btn" aria-label="Annuler" onClick={() => back('/')}>
          <Icon name="close" size={22} />
        </button>
        <div className="grow">
          <h1>{heading}</h1>
          {existingGame && !withGame && <p className="muted">{existingGame.title}</p>}
        </div>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {mode.name === 'new' && draft && (
        <div className="draft-banner">
          {draft.cover_url && (
            <div className={useCover ? 'draft-cover' : 'draft-cover off'}>
              <Thumb src={draft.cover_thumb ?? draft.cover_url} family={draft.family} title={draft.title} />
            </div>
          )}
          <div className="grow">
            <p>
              <strong>Pré-rempli depuis {SOURCE_LABEL[draft.source] ?? draft.source}.</strong> Vérifie, puis complète ton exemplaire.
            </p>
            {draft.cover_url && (
              <label className="check">
                <input type="checkbox" checked={useCover} onChange={(e) => setUseCover(e.target.checked)} /> Utiliser cette jaquette
              </label>
            )}
            {pending.barcode && <p className="muted small">Code-barre {pending.barcode} mémorisé avec la fiche.</p>}
            {family === 'jv' && draftPlatforms.length > 1 && (
              <div className="chips" role="group" aria-label="Plateforme de mon exemplaire">
                {draftPlatforms.map((p) => (
                  <Chip key={p} on={values.platform === p} onClick={() => set('platform', p)}>
                    {p}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="link-btn" onClick={() => back('/ajout')}>
            Changer
          </button>
        </div>
      )}

      {mode.name === 'new' && !draft && (
        <div className="notice">
          <Icon name="edit" size={20} />
          <span className="grow">
            Saisie manuelle{pending.barcode ? ` (code ${pending.barcode} repris)` : ''}. Tu peux aussi <a href={mode.wishlist ? '#/ajout/wishlist' : '#/ajout'}>chercher en ligne</a> ou{' '}
            <a href={mode.wishlist ? '#/scan/wishlist' : '#/scan'}>scanner la boîte</a>.
          </span>
        </div>
      )}

      {withGame && (
        <fieldset className="fset">
          <legend>Famille</legend>
          <div className="chips">
            {FAMILIES.map((f) => (
              <Chip key={f} on={family === f} onClick={() => setFamily(f)}>
                {familyLong[f]}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      {withGame && <Form sections={GAME_SECTIONS} family={family} values={values} set={set} suggestions={suggestions} bases={bases} />}
      {withCopy && <Form sections={COPY_SECTIONS} family={family} values={values} set={set} suggestions={suggestions} bases={bases} />}

      {err && (
        <p className="alert" role="alert">
          {err}
        </p>
      )}

      <div className="edit-foot">
        {mode.name === 'editCopy' && <DeleteCopy copy={existingCopy!} game={existingGame!} />}
        <span className="grow" />
        <button type="button" className="btn" onClick={() => back('/')}>
          Annuler
        </button>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

function DeleteCopy({ copy, game }: { copy: Copy; game: Game }) {
  const { removeCopy, removeGame, copies } = useStore()
  const last = copies.filter((c) => c.game_id === game.id).length <= 1
  return (
    <button
      type="button"
      className="btn ghost danger"
      onClick={async () => {
        const msg = last
          ? `C’est ton seul exemplaire : « ${game.title} » sera retiré de la collection (fiche comprise). Continuer ?`
          : 'Supprimer cet exemplaire ?'
        if (!window.confirm(msg)) return
        try {
          if (last) {
            await removeGame(game.id)
            go('/', true)
          } else {
            await removeCopy(copy.id)
            go(`/jeu/${game.id}`, true)
          }
        } catch (e) {
          window.alert((e as Error).message)
        }
      }}
    >
      <Icon name="trash" size={18} /> Supprimer l’exemplaire
    </button>
  )
}
