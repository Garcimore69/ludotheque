import { useMemo, useState } from 'react'
import { completeness, conditionLabel, formatLabel, playStatusLabel, regionLabel, statusLabel } from '../lib/labels'
import { activeCount, emptyFilters, facet, GROUPS, SORTS, type Filters, type Query, type SortKey } from '../lib/query'
import type { Condition, Format, Item, PlayStatus, Region, Status } from '../lib/types'
import { Chip, Section, Stepper, toggle } from './Controls'
import { Icon } from './Icon'

export interface SavedView {
  name: string
  query: Query
}

interface Props {
  query: Query
  setQuery: (q: Query) => void
  scope: Item[] // éléments de la page (avant filtres) : sert aux compteurs
  resultCount: number
  wishlist: boolean
  saved: SavedView[]
  setSaved: (s: SavedView[]) => void
  onClose?: () => void
}

function FacetChips({ values, selected, onToggle, limit = 12 }: { values: [string, number][]; selected: string[]; onToggle: (v: string) => void; limit?: number }) {
  const [all, setAll] = useState(false)
  const [q, setQ] = useState('')
  if (!values.length) return <p className="muted small">Aucune valeur dans la collection.</p>
  const list = q ? values.filter(([v]) => v.toLowerCase().includes(q.toLowerCase())) : values
  const shown = all || q ? list : list.slice(0, limit)
  // Les valeurs sélectionnées restent visibles même hors du top
  const extra = selected.filter((s) => !shown.some(([v]) => v === s)).map((s) => [s, values.find(([v]) => v === s)?.[1] ?? 0] as [string, number])
  return (
    <>
      {values.length > limit && <input className="input small-input" type="search" placeholder="Filtrer la liste…" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="chips">
        {[...extra, ...shown].map(([v, n]) => (
          <Chip key={v} on={selected.includes(v)} onClick={() => onToggle(v)} count={n}>
            {v}
          </Chip>
        ))}
        {!q && values.length > limit && (
          <button type="button" className="link-btn" onClick={() => setAll(!all)}>
            {all ? 'Moins' : `+ ${values.length - limit} autres`}
          </button>
        )}
      </div>
    </>
  )
}

export function FilterPanel({ query, setQuery, scope, resultCount, wishlist, saved, setSaved, onClose }: Props) {
  const f = query.filters
  const setF = (patch: Partial<Filters>) => setQuery({ ...query, filters: { ...f, ...patch } })
  const scoped = useMemo(() => (query.family === 'all' ? scope : scope.filter((it) => it.game.family === query.family)), [scope, query.family])
  const has = (fam: string) => query.family === 'all' || query.family === fam

  const facets = useMemo(
    () => ({
      platforms: facet(scoped, (it) => [it.copy.platform]),
      languages: facet(scoped, (it) => (it.copy.language ? [it.copy.language] : it.game.languages)),
      publishers: facet(scoped, (it) => it.game.publishers),
      series: facet(scoped, (it) => [it.game.series]),
      genres: facet(scoped, (it) => it.game.genres),
      locations: facet(scoped, (it) => [it.copy.location]),
      tags: facet(scoped, (it) => it.copy.tags),
      completeness: facet(scoped, (it) => [completeness(it.copy)]),
    }),
    [scoped],
  )

  const sortSelect = (k: 'sort1' | 'sort2', d: 'dir1' | 'dir2', label: string) => (
    <label className="field grow">
      <span className="field-label">{label}</span>
      <span className="sort-row">
        <select
          className="input"
          value={query[k]}
          onChange={(e) => {
            const key = e.target.value as SortKey
            setQuery({ ...query, [k]: key, [d]: SORTS.find((s) => s.key === key)!.dir })
          }}
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn boxed"
          aria-label={query[d] === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
          title={query[d] === 'asc' ? 'Croissant' : 'Décroissant'}
          onClick={() => setQuery({ ...query, [d]: query[d] === 'asc' ? 'desc' : 'asc' })}
        >
          {query[d] === 'asc' ? '↑' : '↓'}
        </button>
      </span>
    </label>
  )

  const saveView = () => {
    const name = window.prompt('Nom de ce favori (ex. « JdS 2 joueurs < 30 min ») :')
    if (!name?.trim()) return
    setSaved([...saved.filter((s) => s.name !== name.trim()), { name: name.trim(), query: { ...query, text: '' } }])
  }

  const n = activeCount(f)

  return (
    <div className="fpanel">
      <div className="fpanel-head">
        <h2>Trier et filtrer</h2>
        {onClose && (
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        )}
      </div>

      <div className="fpanel-body">
        <Section title="Favoris" hint={saved.length ? `${saved.length} enregistré${saved.length > 1 ? 's' : ''}` : undefined}>
          <div className="chips">
            {saved.map((s) => (
              <span key={s.name} className="saved-chip">
                <button type="button" className="chip" onClick={() => setQuery({ ...s.query, text: query.text, view: query.view })}>
                  {s.name}
                </button>
                <button type="button" className="saved-del" aria-label={`Supprimer le favori ${s.name}`} onClick={() => setSaved(saved.filter((x) => x !== s))}>
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
            <button type="button" className="chip dashed" onClick={saveView}>
              <Icon name="bookmark" size={14} /> Enregistrer ces réglages
            </button>
          </div>
        </Section>

        <Section title="Tri">
          {sortSelect('sort1', 'dir1', 'Tri principal')}
          {sortSelect('sort2', 'dir2', 'Puis par')}
          <label className="field">
            <span className="field-label">Regrouper par</span>
            <select className="input" value={query.group} onChange={(e) => setQuery({ ...query, group: e.target.value as Query['group'] })}>
              {GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <Section title="Type">
          <div className="chips">
            <Chip on={f.includeExtensions} onClick={() => setF({ includeExtensions: !f.includeExtensions })}>
              Extensions incluses
            </Chip>
          </div>
          {facets.series.length > 0 && (
            <>
              <span className="field-label">Gamme</span>
              <FacetChips values={facets.series} selected={f.series} onToggle={(v) => setF({ series: toggle(f.series, v) })} limit={8} />
            </>
          )}
        </Section>

        {!wishlist && (
          <Section title="Statut">
            <div className="chips">
              {(['owned', 'loaned', 'sold'] as Status[]).map((s) => (
                <Chip key={s} on={f.statuses.includes(s)} onClick={() => setF({ statuses: toggle(f.statuses, s) })} count={scoped.filter((it) => it.copy.status === s).length}>
                  {statusLabel[s]}
                </Chip>
              ))}
            </div>
            <p className="muted small">Sans choix : possédés et prêtés (les jeux vendus ou donnés sont masqués).</p>
          </Section>
        )}

        {has('jv') && (
          <Section title="Statut de jeu" hint="Jeux vidéo">
            <div className="chips">
              {(['a_faire', 'en_cours', 'fini', 'cent', 'none'] as (PlayStatus | 'none')[]).map((s) => (
                <Chip key={s} on={f.playStatus.includes(s)} onClick={() => setF({ playStatus: toggle(f.playStatus, s) })}>
                  {s === 'none' ? 'Non renseigné' : playStatusLabel[s]}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        {has('jds') && (
          <Section title="Pratique" hint="Jeux de société">
            <div className="line">
              <span className="grow">Jouable à</span>
              <Stepper label="Nombre de joueurs" value={f.players} onChange={(v) => setF({ players: v })} />
            </div>
            <span className="field-label">Durée max (min)</span>
            <div className="chips">
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <Chip key={d} on={f.durationMax === d} onClick={() => setF({ durationMax: f.durationMax === d ? null : d })}>
                  ≤ {d}
                </Chip>
              ))}
            </div>
            <div className="line">
              <span className="grow">Âge minimum du joueur le plus jeune</span>
              <Stepper label="Âge" value={f.ageMax} onChange={(v) => setF({ ageMax: v })} min={3} max={18} />
            </div>
          </Section>
        )}

        <Section title="Notes" hint="Note perso, communauté, non notés" collapsible open={f.ratingMin != null || f.unrated || f.communityMin != null}>
          <span className="field-label">Ma note ≥</span>
          <div className="chips">
            {[5, 6, 7, 8, 9].map((r) => (
              <Chip key={r} on={f.ratingMin === r && !f.unrated} onClick={() => setF({ ratingMin: f.ratingMin === r ? null : r, unrated: false })}>
                {r}
              </Chip>
            ))}
            <Chip on={f.unrated} onClick={() => setF({ unrated: !f.unrated, ratingMin: null })}>
              Non notés
            </Chip>
          </div>
          <span className="field-label">Note communauté ≥</span>
          <div className="chips">
            {[6, 7, 7.5, 8].map((r) => (
              <Chip key={r} on={f.communityMin === r} onClick={() => setF({ communityMin: f.communityMin === r ? null : r })}>
                {r.toLocaleString('fr-FR')}
              </Chip>
            ))}
          </div>
        </Section>

        {has('jv') && (
          <Section
            title="Supports"
            hint="Plateforme, physique / démat, région, complétude"
            collapsible
            open={!!(f.platforms.length || f.formats.length || f.regions.length || f.completeness.length || f.conditions.length)}
          >
            <span className="field-label">Plateforme</span>
            <FacetChips values={facets.platforms} selected={f.platforms} onToggle={(v) => setF({ platforms: toggle(f.platforms, v) })} limit={10} />
            <span className="field-label">Format</span>
            <div className="chips">
              {(['physique', 'demat'] as Format[]).map((v) => (
                <Chip key={v} on={f.formats.includes(v)} onClick={() => setF({ formats: toggle(f.formats, v) })}>
                  {formatLabel[v]}
                </Chip>
              ))}
            </div>
            <span className="field-label">Région</span>
            <div className="chips">
              {(['PAL', 'NTSC', 'NTSC-J'] as Region[]).map((v) => (
                <Chip key={v} on={f.regions.includes(v)} onClick={() => setF({ regions: toggle(f.regions, v) })}>
                  {regionLabel[v]}
                </Chip>
              ))}
            </div>
            <span className="field-label">Complétude</span>
            <FacetChips values={facets.completeness} selected={f.completeness} onToggle={(v) => setF({ completeness: toggle(f.completeness, v) })} />
            <span className="field-label">État</span>
            <div className="chips">
              {(Object.keys(conditionLabel) as Condition[]).map((v) => (
                <Chip key={v} on={f.conditions.includes(v)} onClick={() => setF({ conditions: toggle(f.conditions, v) })}>
                  {conditionLabel[v]}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="Dates" hint="Ajout, sortie" collapsible open={f.addedDays != null || f.yearFrom != null || f.yearTo != null}>
          <span className="field-label">Ajoutés depuis</span>
          <div className="chips">
            {[
              [7, '7 jours'],
              [31, '1 mois'],
              [365, '1 an'],
            ].map(([d, l]) => (
              <Chip key={d} on={f.addedDays === d} onClick={() => setF({ addedDays: f.addedDays === d ? null : (d as number) })}>
                {l}
              </Chip>
            ))}
          </div>
          <span className="field-label">Année de sortie</span>
          <div className="two">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              placeholder="De"
              aria-label="Année de sortie minimum"
              value={f.yearFrom ?? ''}
              onChange={(e) => setF({ yearFrom: e.target.value ? Number(e.target.value) : null })}
            />
            <input
              className="input"
              type="number"
              inputMode="numeric"
              placeholder="À"
              aria-label="Année de sortie maximum"
              value={f.yearTo ?? ''}
              onChange={(e) => setF({ yearTo: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </Section>

        <Section
          title="Inventaire"
          hint="Genre, langue, éditeur, emplacement, tags"
          collapsible
          open={!!(f.genres.length || f.languages.length || f.publishers.length || f.locations.length || f.tags.length)}
        >
          <span className="field-label">Genre / catégorie</span>
          <FacetChips values={facets.genres} selected={f.genres} onToggle={(v) => setF({ genres: toggle(f.genres, v) })} limit={10} />
          <span className="field-label">Langue</span>
          <FacetChips values={facets.languages} selected={f.languages} onToggle={(v) => setF({ languages: toggle(f.languages, v) })} limit={6} />
          <span className="field-label">Éditeur</span>
          <FacetChips values={facets.publishers} selected={f.publishers} onToggle={(v) => setF({ publishers: toggle(f.publishers, v) })} limit={10} />
          <span className="field-label">Emplacement</span>
          <FacetChips values={facets.locations} selected={f.locations} onToggle={(v) => setF({ locations: toggle(f.locations, v) })} />
          <span className="field-label">Tags</span>
          <FacetChips values={facets.tags} selected={f.tags} onToggle={(v) => setF({ tags: toggle(f.tags, v) })} />
        </Section>
      </div>

      <div className="fpanel-foot">
        <button type="button" className="btn" disabled={!n} onClick={() => setQuery({ ...query, filters: emptyFilters() })}>
          Réinitialiser{n ? ` (${n})` : ''}
        </button>
        {onClose && (
          <button type="button" className="btn primary grow" onClick={onClose}>
            Voir {resultCount} jeu{resultCount > 1 ? 'x' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
