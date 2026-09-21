import type { ReactNode } from 'react'
import { Icon, type IconName } from './components/Icon'
import { CollectionPage } from './pages/CollectionPage'
import { EditPage } from './pages/EditPage'
import { GamePage } from './pages/GamePage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { useRoute, type Route } from './lib/router'
import { useStore } from './lib/store'

interface NavItem {
  key: string
  href: string
  label: string
  icon: IconName
  active: (r: Route) => boolean
}

const NAV: NavItem[] = [
  { key: 'collection', href: '#/', label: 'Collection', icon: 'collection', active: (r) => r.name === 'collection' || r.name === 'game' },
  { key: 'wishlist', href: '#/wishlist', label: 'Wishlist', icon: 'heart', active: (r) => r.name === 'wishlist' },
  { key: 'add', href: '#/ajout', label: 'Ajouter', icon: 'plus', active: (r) => r.name === 'new' },
  { key: 'settings', href: '#/reglages', label: 'Réglages', icon: 'settings', active: (r) => r.name === 'settings' },
]

function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { items } = useStore()
  const owned = items.filter((i) => i.copy.status === 'owned' || i.copy.status === 'loaned').length
  const wish = items.filter((i) => i.copy.status === 'wishlist').length
  const editing = route.name === 'new' || route.name === 'editGame' || route.name === 'editCopy' || route.name === 'newCopy'

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Navigation principale">
        <a className="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={32} height={32} />
          <span>Ludothèque</span>
        </a>
        <a className="btn primary side-add" href="#/ajout">
          <Icon name="plus" size={18} /> Ajouter un jeu
        </a>
        {NAV.filter((n) => n.key !== 'add').map((n) => (
          <a key={n.key} href={n.href} className={n.active(route) ? 'side-link active' : 'side-link'} aria-current={n.active(route) ? 'page' : undefined}>
            <Icon name={n.icon} />
            <span className="grow">{n.label}</span>
            {n.key === 'collection' && <span className="muted small">{owned}</span>}
            {n.key === 'wishlist' && wish > 0 && <span className="muted small">{wish}</span>}
          </a>
        ))}
        <div className="side-soon">
          <span className="side-soon-title">Bientôt</span>
          <span>Recherche en ligne &amp; scan · lot 2</span>
          <span>Prêts, listes, stats, argus · lot 3</span>
        </div>
      </nav>

      <main className={editing ? 'content editing' : 'content'}>{children}</main>

      {!editing && (
        <nav className="bottombar" aria-label="Navigation principale">
          {NAV.map((n) =>
            n.key === 'add' ? (
              <a key={n.key} href={n.href} className="bb-add" aria-label="Ajouter un jeu">
                <span className="bb-add-btn">
                  <Icon name="plus" size={28} stroke={2} />
                </span>
                <span>Ajouter</span>
              </a>
            ) : (
              <a key={n.key} href={n.href} className={n.active(route) ? 'bb-link active' : 'bb-link'} aria-current={n.active(route) ? 'page' : undefined}>
                <Icon name={n.icon} size={24} stroke={n.active(route) ? 2.1 : 1.8} />
                <span>{n.label}</span>
              </a>
            ),
          )}
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const { session, authReady } = useStore()
  const route = useRoute()

  if (!authReady) return <div className="splash" aria-busy="true" />
  if (!session) return <LoginPage />

  let page: ReactNode
  switch (route.name) {
    case 'collection':
      page = <CollectionPage key="c" wishlist={false} />
      break
    case 'wishlist':
      page = <CollectionPage key="w" wishlist />
      break
    case 'game':
      page = <GamePage id={route.id} />
      break
    case 'new':
      page = <EditPage key={`new-${route.wishlist}`} mode={route} />
      break
    case 'editGame':
      page = <EditPage key={`eg-${route.id}`} mode={route} />
      break
    case 'newCopy':
      page = <EditPage key={`nc-${route.gameId}`} mode={route} />
      break
    case 'editCopy':
      page = <EditPage key={`ec-${route.id}`} mode={route} />
      break
    case 'settings':
      page = <SettingsPage />
      break
  }

  return <Shell route={route}>{page}</Shell>
}
