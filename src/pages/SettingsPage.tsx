import { useEffect, useState } from 'react'
import { Segmented } from '../components/Controls'
import { Icon } from '../components/Icon'
import { useLocalState } from '../lib/hooks'
import { completeness, familyShort, statusLabel } from '../lib/labels'
import { ping, type Ping } from '../lib/online'
import { useStore } from '../lib/store'
import { checkSupabase, type Diagnostic } from '../lib/supabase'

export type Theme = 'auto' | 'light' | 'dark'

export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function SettingsPage() {
  const { session, items, games, copies, reload, loading, signOut } = useStore()
  const [theme, setTheme] = useLocalState<Theme>('ludo-theme', () => 'auto')
  const [diag, setDiag] = useState<Diagnostic | null>(null)
  const [fn, setFn] = useState<{ p?: Ping; err?: string; testing?: boolean } | null>(null)

  useEffect(() => {
    checkSupabase().then(setDiag)
    ping(false).then(
      (p) => setFn({ p }),
      (e) => setFn({ err: (e as Error).message }),
    )
  }, [])

  const testSources = () => {
    setFn((f) => ({ ...f, testing: true }))
    ping(true).then(
      (p) => setFn({ p }),
      (e) => setFn({ err: (e as Error).message }),
    )
  }

  const noCover = [...games.values()].filter((g) => !g.cover_url).length

  const stamp = new Date().toISOString().slice(0, 10)

  const exportJson = () =>
    download(`ludotheque-${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), games: [...games.values()], copies }, null, 2), 'application/json')

  const exportCsv = () => {
    const head = ['Titre', 'Type', 'Nature', 'Statut', 'Plateforme', 'Région', 'Complétude', 'État', 'Année', 'Éditeurs', 'Gamme', 'Note perso', 'Note communauté', 'Prix payé', 'Valeur', 'Emplacement', 'Tags', 'Codes-barres', 'Ajouté le']
    const rows = items.map(({ game: g, copy: c }) => [
      g.title,
      familyShort[g.family],
      g.kind,
      statusLabel[c.status],
      c.platform,
      c.region,
      g.family === 'jv' ? completeness(c) : null,
      c.condition,
      g.year,
      g.publishers,
      g.series,
      c.rating,
      g.community_rating,
      c.price_paid,
      c.value_estimate,
      c.location,
      c.tags,
      g.barcodes,
      c.added_at.slice(0, 10),
    ])
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n')
    download(`ludotheque-${stamp}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <div className="settings">
      <div className="page-head">
        <h1>Réglages</h1>
      </div>

      <section className="block">
        <h2>Compte</h2>
        <p>
          Connecté en tant que <strong>{session?.user.email}</strong>
        </p>
        <button type="button" className="btn" onClick={signOut}>
          <Icon name="logout" size={18} /> Se déconnecter
        </button>
      </section>

      <section className="block">
        <h2>Apparence</h2>
        <Segmented<Theme>
          label="Thème"
          value={theme}
          onChange={(t) => {
            setTheme(t)
            applyTheme(t)
          }}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
          ]}
        />
      </section>

      <section className="block">
        <h2>Mes données</h2>
        <p className="muted">
          {games.size} fiches, {copies.length} exemplaires. Les exports restent sur ton appareil : garde-les hors du dépôt GitHub.
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportCsv}>
            <Icon name="download" size={18} /> Export CSV (tableur)
          </button>
          <button type="button" className="btn" onClick={exportJson}>
            <Icon name="download" size={18} /> Sauvegarde JSON complète
          </button>
          <button type="button" className="btn" onClick={reload} disabled={loading}>
            <Icon name="refresh" size={18} /> {loading ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
      </section>

      <section className="block">
        <h2>Recherche en ligne</h2>
        {!fn ? (
          <p className="muted">Vérification de la fonction « recherche »…</p>
        ) : fn.err ? (
          <p className="alert">{fn.err}</p>
        ) : (
          <ul className="checks">
            {(
              [
                ['bgg', 'BoardGameGeek / RPGGeek (JdS, JdR)', 'secret BGG_TOKEN manquant'],
                ['igdb', 'IGDB (jeux vidéo)', 'secrets TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants'],
                ['gameupc', 'GameUPC (code-barre JdS)', ''],
                ['upcitemdb', 'UPCitemdb (code-barre JV, 100 / jour)', ''],
                ['openlibrary', 'Open Library (ISBN, livres)', ''],
              ] as const
            ).map(([k, label, missing]) => {
              const on = fn.p?.sources[k]
              const check = fn.p?.checks[k]
              const cls = !on ? 'ko' : check && check !== 'ok' ? 'ko' : 'ok'
              return (
                <li key={k}>
                  <span className={`dot ${cls}`} /> {label} : {!on ? missing : check ? (check === 'ok' ? 'testé, OK' : check) : 'prêt'}
                </li>
              )
            })}
          </ul>
        )}
        <div className="btn-row">
          <button type="button" className="btn" onClick={testSources} disabled={fn?.testing}>
            <Icon name="refresh" size={18} /> {fn?.testing ? 'Test en cours…' : 'Tester les sources'}
          </button>
          <a className="btn" href="#/jaquettes">
            <Icon name="image" size={18} /> Jaquettes automatiques{noCover ? ` (${noCover} sans image)` : ''}
          </a>
        </div>
        <p className="muted small attribution">
          Données :{' '}
          <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer">
            Data from BoardGameGeek
          </a>
          ,{' '}
          <a href="https://www.igdb.com" target="_blank" rel="noreferrer">
            IGDB
          </a>
          ,{' '}
          <a href="https://openlibrary.org" target="_blank" rel="noreferrer">
            Open Library
          </a>
          , GameUPC, UPCitemdb.
        </p>
      </section>

      <section className="block">
        <h2>Diagnostic</h2>
        <ul className="checks">
          <li>
            <span className="dot ok" /> Application publiée
          </li>
          <li>
            <span className={`dot ${!diag ? 'wait' : diag.etat === 'ok' ? 'ok' : 'ko'}`} /> Base Supabase :{' '}
            {!diag ? 'vérification…' : diag.etat === 'ok' ? 'connectée' : diag.etat === 'absent' ? `non configurée (${diag.manque.join(', ')})` : diag.detail}
          </li>
        </ul>
        <p className="muted small">Version lot 2 · collection, tri, filtres, wishlist, photos, recherche en ligne, scan, jaquettes.</p>
      </section>
    </div>
  )
}
