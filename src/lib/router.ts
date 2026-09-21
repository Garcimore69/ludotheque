import { useEffect, useState } from 'react'

/**
 * Routage par ancre (#/…) : compatible GitHub Pages sans configuration serveur.
 *   #/                     collection
 *   #/wishlist             wishlist
 *   #/jeu/<id>             fiche jeu
 *   #/ajout                nouveau jeu (#/ajout/wishlist : directement en wishlist)
 *   #/jeu/<id>/modifier    modifier la fiche
 *   #/jeu/<id>/exemplaire  ajouter un exemplaire
 *   #/exemplaire/<id>      modifier un exemplaire
 *   #/reglages             réglages
 */
export type Route =
  | { name: 'collection' }
  | { name: 'wishlist' }
  | { name: 'game'; id: string }
  | { name: 'new'; wishlist: boolean }
  | { name: 'editGame'; id: string }
  | { name: 'newCopy'; gameId: string }
  | { name: 'editCopy'; id: string }
  | { name: 'settings' }

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [a, b, c] = parts
  if (a === 'wishlist') return { name: 'wishlist' }
  if (a === 'ajout') return { name: 'new', wishlist: b === 'wishlist' }
  if (a === 'reglages') return { name: 'settings' }
  if (a === 'jeu' && b && c === 'modifier') return { name: 'editGame', id: b }
  if (a === 'jeu' && b && c === 'exemplaire') return { name: 'newCopy', gameId: b }
  if (a === 'jeu' && b) return { name: 'game', id: b }
  if (a === 'exemplaire' && b) return { name: 'editCopy', id: b }
  return { name: 'collection' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function go(path: string, replace = false) {
  const h = '#' + path
  if (replace) window.location.replace(h)
  else window.location.hash = path
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back()
  else go(fallback)
}
