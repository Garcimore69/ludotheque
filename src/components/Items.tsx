import type { ReactNode } from 'react'
import { cardLines, completeness, conditionLabel, euro, familyShort, playStatusLabel, rating, regionLabel, statusLabel } from '../lib/labels'
import type { SortKey, Query, Dir } from '../lib/query'
import type { Family, Item } from '../lib/types'
import { Cover } from './Cover'
import { Icon } from './Icon'

export function FamilyBadge({ family }: { family: Family }) {
  return <span className={`badge fam-${family}`}>{familyShort[family]}</span>
}

function StatusMark({ item }: { item: Item }) {
  const s = item.copy.status
  if (s === 'owned') return null
  return <span className={`status-mark st-${s}`}>{statusLabel[s]}</span>
}

const href = (it: Item) => `#/jeu/${it.game.id}`

export function ItemCard({ item }: { item: Item }) {
  const [l1, l2] = cardLines(item.game, item.copy)
  return (
    <a className="card" href={href(item)}>
      <div className={`card-media fam-bg-${item.game.family}`}>
        <Cover game={item.game} copy={item.copy} />
        <span className="card-badge">
          <FamilyBadge family={item.game.family} />
        </span>
        <StatusMark item={item} />
      </div>
      <div className="card-body">
        <div className="card-title">{item.game.title}</div>
        <div className="card-meta">{l1}</div>
        <div className="card-meta">{l2}</div>
      </div>
    </a>
  )
}

export function ItemRow({ item }: { item: Item }) {
  const [l1, l2] = cardLines(item.game, item.copy)
  const r = item.copy.rating ?? item.game.community_rating
  return (
    <a className="row" href={href(item)}>
      <Cover game={item.game} copy={item.copy} size="sm" />
      <div className="row-main">
        <div className="row-title">{item.game.title}</div>
        <div className="row-meta">
          <FamilyBadge family={item.game.family} />
          <span>{l1}</span>
        </div>
        <div className="row-meta muted">{l2}</div>
      </div>
      <div className="row-side">
        {item.copy.status !== 'owned' && <span className={`status-mark inline st-${item.copy.status}`}>{statusLabel[item.copy.status]}</span>}
        {r != null && (
          <span className={item.copy.rating != null ? 'row-rating mine' : 'row-rating'} title={item.copy.rating != null ? 'Note perso' : 'Note communauté'}>
            {r.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
          </span>
        )}
      </div>
    </a>
  )
}

interface Col {
  label: string
  sort?: SortKey
  cell: (it: Item) => string | null | undefined
  num?: boolean
}

const COLS: Col[] = [
  { label: 'Type', sort: 'family', cell: (it) => familyShort[it.game.family] },
  { label: 'Plateforme / éditeur', sort: 'platform', cell: (it) => it.copy.platform ?? it.game.publishers[0] },
  { label: 'Année', sort: 'year', cell: (it) => (it.game.year ? String(it.game.year) : null), num: true },
  { label: 'Région', cell: (it) => (it.copy.region ? regionLabel[it.copy.region].split(' ')[0] : null) },
  { label: 'Complétude', cell: (it) => completeness(it.copy) },
  { label: 'État', cell: (it) => (it.copy.condition ? conditionLabel[it.copy.condition] : null) },
  { label: 'Statut', cell: (it) => (it.copy.status !== 'owned' ? statusLabel[it.copy.status] : it.copy.play_status ? playStatusLabel[it.copy.play_status] : null), sort: 'playStatus' },
  { label: 'Ma note', sort: 'rating', cell: (it) => rating(it.copy.rating)?.replace('/10', ''), num: true },
  { label: 'Communauté', sort: 'community', cell: (it) => it.game.community_rating?.toLocaleString('fr-FR', { maximumFractionDigits: 1 }), num: true },
  { label: 'Valeur', sort: 'value', cell: (it) => euro(it.copy.value_estimate), num: true },
  { label: 'Ajouté', sort: 'added', cell: (it) => new Date(it.copy.added_at).toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' }), num: true },
]

export function ItemTable({ items, query, onSort }: { items: Item[]; query: Query; onSort: (k: SortKey, d: Dir) => void }) {
  const head = (label: string, k?: SortKey, num?: boolean) => {
    const active = k && query.sort1 === k
    const next: Dir = active ? (query.dir1 === 'asc' ? 'desc' : 'asc') : k === 'title' || k === 'platform' || k === 'family' ? 'asc' : 'desc'
    return (
      <th key={label} className={num ? 'num' : undefined} aria-sort={active ? (query.dir1 === 'asc' ? 'ascending' : 'descending') : undefined}>
        {k ? (
          <button type="button" className={active ? 'th-btn active' : 'th-btn'} onClick={() => onSort(k, next)}>
            {label}
            {active && <span aria-hidden="true">{query.dir1 === 'asc' ? ' ↑' : ' ↓'}</span>}
          </button>
        ) : (
          label
        )}
      </th>
    )
  }
  return (
    <div className="table-wrap">
      <table className="items">
        <thead>
          <tr>
            {head('Titre', 'title')}
            {COLS.map((c) => head(c.label, c.sort, c.num))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.copy.id}>
              <td className="t-title">
                <a href={href(it)}>
                  <Cover game={it.game} copy={it.copy} size="sm" />
                  <span>{it.game.title}</span>
                </a>
              </td>
              {COLS.map((c) => (
                <td key={c.label} className={c.num ? 'num' : undefined}>
                  {c.cell(it) ?? <span className="muted">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="collection" size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}
