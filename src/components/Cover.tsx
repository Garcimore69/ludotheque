import { useState } from 'react'
import { useStore } from '../lib/store'
import type { Copy, Game } from '../lib/types'

// Aplats des maquettes : couleurs sourdes, texte blanc lisible (contraste ≥ 4.5:1).
const SWATCHES = ['#7A4B2A', '#2D6E8C', '#4A3A7A', '#2E6A5E', '#9A3B2A', '#26303B', '#5A1D26', '#3E2A4F', '#6B2B1F', '#3F5A2A', '#1F4E6B', '#6A3F5F']

export function swatch(title: string): string {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return SWATCHES[h % SWATCHES.length]
}

/**
 * Jaquette : photo de l'exemplaire, sinon jaquette de la fiche, sinon aplat coloré avec le titre.
 */
export function Cover({ game, copy, size = 'md' }: { game: Game; copy?: Copy | null; size?: 'sm' | 'md' | 'lg' }) {
  const { photoUrl } = useStore()
  const [broken, setBroken] = useState<string | null>(null)
  // Vignette légère dans les listes ; jaquette pleine taille ailleurs
  const web = size === 'sm' ? (game.cover_thumb ?? game.cover_url) : (game.cover_url ?? game.cover_thumb)
  const src = photoUrl(copy?.image_path ?? null) ?? web ?? null
  if (src && broken !== src) {
    return (
      <div className={`cover cover-${size} has-img`}>
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(src)} />
      </div>
    )
  }
  return (
    <div className={`cover cover-${size}`} style={{ background: swatch(game.title) }} aria-hidden="true">
      <span className="cover-title">{game.title}</span>
    </div>
  )
}
