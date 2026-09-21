import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Segmented } from '../components/Controls'
import { FilterPanel, type SavedView } from '../components/FilterPanel'
import { Icon } from '../components/Icon'
import { EmptyState, ItemCard, ItemRow, ItemTable } from '../components/Items'
import { useLocalState, useWide } from '../lib/hooks'
import { FAMILIES, familyLabel } from '../lib/labels'
import { activeCount, defaultQuery, emptyFilters, groupItems, matches, sortItems, sortLabel, type Query, type View } from '../lib/query'
import { useStore } from '../lib/store'
import type { Family } from '../lib/types'

const migrate = (q: Query): Query => ({ ...defaultQuery(), ...q, filters: { ...emptyFilters(), ...q.filters } })

export function CollectionPage({ wishlist }: { wishlist: boolean }) {
  const { items, loading, ready, error, reload } = useStore()
  const wide = useWide()
  const [query, setQuery] = useLocalState<Query>(wishlist ? 'ludo-query-wishlist' : 'ludo-query-collection', defaultQuery, migrate)
  const [saved, setSaved] = useLocalState<SavedView[]>('ludo-saved-views', () => [])
  const [panelOpen, setPanelOpen] = useLocalState<boolean>('ludo-panel-open', () => true)
  const [sheet, setSheet] = useState(false)
  const text = useDeferredValue(query.text)

  // Périmètre de la page : wishlist, ou collection (possédés + prêtés, vendus sur demande)
  const scope = useMemo(
    () =>
      items.filter((it) =>
        wishlist
          ? it.copy.status === 'wishlist'
          : it.copy.status !== 'wishlist' && (query.filters.statuses.length > 0 || it.copy.status !== 'sold'),
      ),
    [items, wishlist, query.filters.statuses.length],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, jds: 0, jv: 0, jdr: 0 }
    const q = { ...query, family: 'all' as const, text }
    for (const it of scope) if (matches(it, q)) {
      c.all++
      c[it.game.family]++
    }
    return c
  }, [scope, query, text])

  const results = useMemo(() => {
    const q = { ...query, text }
    return sortItems(
      scope.filter((it) => matches(it, q)),
      q,
    )
  }, [scope, query, text])

  const groups = useMemo(() => groupItems(results, query.view === 'table' ? 'none' : query.group), [results, query.group, query.view])
  const nFilters = activeCount(query.filters)

  // Le panneau mobile se ferme si on passe en grand écran
  useEffect(() => {
    if (wide) setSheet(false)
  }, [wide])

  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sheet])

  const title = wishlist ? 'Wishlist' : 'Collection'
  const showPanel = wide && panelOpen
  const panel = (
    <FilterPanel
      query={query}
      setQuery={setQuery}
      scope={scope}
      resultCount={results.length}
      wishlist={wishlist}
      saved={saved}
      setSaved={setSaved}
      onClose={wide ? undefined : () => setSheet(false)}
    />
  )

  const openFilters = () => (wide ? setPanelOpen(!panelOpen) : setSheet(true))

  return (
    <div className={showPanel ? 'with-panel' : undefined}>
      <div className={query.group === 'letter' && query.view !== 'table' && groups.length > 3 ? 'page-main has-az' : 'page-main'}>
        <header className="topbar">
          <label className="searchbox">
            <Icon name="search" />
            <span className="sr">Rechercher dans la {wishlist ? 'wishlist' : 'collection'}</span>
            <input
              type="search"
              placeholder={`Rechercher dans ${wishlist ? 'la wishlist' : 'ma collection'}…`}
              value={query.text}
              onChange={(e) => setQuery({ ...query, text: e.target.value })}
            />
            {query.text && (
              <button type="button" className="icon-btn small" aria-label="Effacer" onClick={() => setQuery({ ...query, text: '' })}>
                <Icon name="close" size={18} />
              </button>
            )}
          </label>
          <a className="icon-btn only-mobile" href={wishlist ? '#/ajout/wishlist' : '#/ajout'} aria-label="Ajouter un jeu">
            <Icon name="plus" size={22} />
          </a>
        </header>

        <div className="page-head">
          <h1>{title}</h1>
          <span className="muted">
            {scope.length} {wishlist ? 'envie' + (scope.length > 1 ? 's' : '') : 'jeu' + (scope.length > 1 ? 'x' : '')}
          </span>
          {loading && <span className="muted small">Mise à jour…</span>}
        </div>

        {error && (
          <div className="alert" role="alert">
            Impossible de charger la collection : {error}{' '}
            <button type="button" className="link-btn" onClick={reload}>
              Réessayer
            </button>
          </div>
        )}

        <div className="tabs" role="tablist" aria-label="Type de jeu">
          {(['all', ...FAMILIES] as (Family | 'all')[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={query.family === f}
              className={query.family === f ? 'chip big on' : 'chip big'}
              onClick={() => setQuery({ ...query, family: f })}
            >
              {f === 'all' ? 'Tout' : familyLabel[f]}
              <span className="chip-count">{counts[f]}</span>
            </button>
          ))}
        </div>

        <div className="toolbar">
          <button type="button" className="btn small" onClick={openFilters}>
            <Icon name="sort" size={18} />
            {sortLabel(query.sort1)} {query.dir1 === 'asc' ? '↑' : '↓'}
          </button>
          <Segmented<View>
            label="Affichage"
            value={query.view}
            onChange={(v) => setQuery({ ...query, view: v })}
            options={[
              { value: 'grid', label: <Icon name="grid" size={18} />, title: 'Grille' },
              { value: 'list', label: <Icon name="list" size={18} />, title: 'Liste' },
              { value: 'table', label: <Icon name="table" size={18} />, title: 'Tableau' },
            ]}
          />
          <span className="grow" />
          <button type="button" className={nFilters ? 'btn small active' : 'btn small'} onClick={openFilters} aria-expanded={wide ? panelOpen : sheet}>
            <Icon name="filter" size={18} />
            Filtrer
            {nFilters > 0 && <span className="pill">{nFilters}</span>}
          </button>
        </div>

        {!ready ? (
          <p className="muted pad">{error ? '' : 'Chargement de la collection…'}</p>
        ) : results.length === 0 ? (
          scope.length === 0 ? (
            <EmptyState
              title={wishlist ? 'Wishlist vide' : 'Collection vide'}
              text={wishlist ? 'Ajoute un jeu que tu voudrais avoir.' : 'Ajoute ton premier jeu, ou lance l’import initial (voir le guide du lot 1).'}
              action={
                <a className="btn primary" href={wishlist ? '#/ajout/wishlist' : '#/ajout'}>
                  <Icon name="plus" size={18} /> Ajouter un jeu
                </a>
              }
            />
          ) : (
            <EmptyState
              title="Aucun jeu ne correspond"
              text="Modifie la recherche ou les filtres."
              action={
                <button type="button" className="btn" onClick={() => setQuery({ ...query, text: '', filters: emptyFilters() })}>
                  Tout réinitialiser
                </button>
              }
            />
          )
        ) : query.view === 'table' ? (
          <>
            <div className="group-head">
              <span className="grow" />
              <span className="muted small">
                {results.length} / {scope.length}
              </span>
            </div>
            <ItemTable items={results} query={query} onSort={(k, d) => setQuery({ ...query, sort1: k, dir1: d })} />
          </>
        ) : (
          <div className="groups">
            {groups.map((g, i) => (
              <section key={g.key || 'all'} id={g.key ? `g-${g.key}` : undefined} className="group">
                <div className="group-head">
                  {g.key && <h2>{g.key}</h2>}
                  <span className="rule" />
                  <span className="muted small">{i === 0 ? `${results.length} / ${scope.length}` : g.items.length}</span>
                </div>
                <div className={query.view === 'grid' ? 'grid' : 'list'}>
                  {g.items.map((it) => (query.view === 'grid' ? <ItemCard key={it.copy.id} item={it} /> : <ItemRow key={it.copy.id} item={it} />))}
                </div>
              </section>
            ))}
          </div>
        )}

        {query.group === 'letter' && query.view !== 'table' && groups.length > 3 && (
          <nav className="az" aria-label="Aller à la lettre">
            {groups.map((g) => (
              <a key={g.key} href={`#g-${g.key}`} onClick={(e) => {
                e.preventDefault()
                document.getElementById(`g-${g.key}`)?.scrollIntoView({ block: 'start' })
              }}>
                {g.key}
              </a>
            ))}
          </nav>
        )}
      </div>

      {showPanel && <aside className="side-panel">{panel}</aside>}

      {sheet && !wide && (
        <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Trier et filtrer">
            <span className="sheet-grip" aria-hidden="true" />
            {panel}
          </div>
        </div>
      )}
    </div>
  )
}
