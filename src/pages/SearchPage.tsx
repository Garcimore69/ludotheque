import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { CandidateRow, LocalRow, SourceErrors, useChoose } from '../components/Online'
import { useLocalState } from '../lib/hooks'
import { FAMILIES, familyLabel, familyLong } from '../lib/labels'
import { cleanCode, localSearch, lookupBarcode, searchOnline, setPending, type Candidate } from '../lib/online'
import { back, go } from '../lib/router'
import { useStore } from '../lib/store'
import type { Family } from '../lib/types'

type Scope = Family | 'all'

interface Online {
  key: string
  loading: boolean
  results: Candidate[]
  errors: Record<string, string>
  error: string | null
  product: string | null
}

const GROUPS: { key: string; family: Family; label: string; test: (c: Candidate) => boolean }[] = [
  { key: 'jds', family: 'jds', label: 'BoardGameGeek', test: (c) => c.family === 'jds' },
  { key: 'jv', family: 'jv', label: 'IGDB', test: (c) => c.family === 'jv' },
  { key: 'rpg', family: 'jdr', label: 'RPGGeek', test: (c) => c.family === 'jdr' && c.source === 'bgg' },
  { key: 'book', family: 'jdr', label: 'Open Library (livres)', test: (c) => c.family === 'jdr' && c.source === 'openlibrary' },
]

const looksLikeCode = (q: string) => /^[\d\s-]{8,17}[\dXx]?$/.test(q.trim()) && cleanCode(q).length >= 8

export function SearchPage({ wishlist, initial, code }: { wishlist: boolean; initial: string; code: string }) {
  const { games } = useStore()
  const [q, setQ] = useState(initial)
  const [scope, setScope] = useLocalState<Scope>('ludo-search-scope', () => 'all')
  const [online, setOnline] = useState<Online | null>(null)
  const [more, setMore] = useState<Record<string, boolean>>({})
  const [barcode, setBarcode] = useState<string | undefined>(code ? cleanCode(code) : undefined)
  const input = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const { choose, busy, error: chooseError, rememberCode } = useChoose({ barcode, wishlist })

  const local = useMemo(() => localSearch(games.values(), q, 8), [games, q])
  const families: Family[] = scope === 'all' ? FAMILIES : [scope]

  const run = async (text: string, fams: Family[]) => {
    const t = text.trim()
    const key = `${fams.join(',')}|${t}`
    if (t.length < 3) {
      setOnline(null)
      return
    }
    const id = ++seq.current
    setOnline((o) => ({ key, loading: true, results: o?.key === key ? o.results : [], errors: {}, error: null, product: null }))
    try {
      if (looksLikeCode(t)) {
        const code = cleanCode(t)
        const r = await lookupBarcode(code)
        if (id !== seq.current) return
        setBarcode(code)
        setOnline({ key, loading: false, results: r.candidates, errors: r.errors, error: null, product: r.product?.title ?? null })
      } else {
        const r = await searchOnline(t, fams)
        if (id !== seq.current) return
        setOnline({ key, loading: false, results: r.results, errors: r.errors, error: null, product: null })
      }
    } catch (e) {
      if (id !== seq.current) return
      setOnline({ key, loading: false, results: [], errors: {}, error: (e as Error).message, product: null })
    }
  }

  // Recherche en ligne après une courte pause de frappe ; la recherche locale est instantanée.
  useEffect(() => {
    const t = setTimeout(() => run(q, families), 650)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope])

  // L'adresse garde la recherche : le bouton Retour depuis le formulaire la retrouve.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (barcode) params.set('code', barcode)
      const h = `#/ajout${wishlist ? '/wishlist' : ''}${params.size ? `?${params}` : ''}`
      if (window.location.hash !== h) history.replaceState(null, '', h)
    }, 650)
    return () => clearTimeout(t)
  }, [q, barcode, wishlist])

  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches || !initial) input.current?.focus()
  }, [initial])

  const manual = () => {
    setPending({ barcode, wishlist })
    go(`/ajout/manuel${wishlist ? '/wishlist' : ''}`)
  }

  const dropBarcode = () => setBarcode(undefined)

  const groups = GROUPS.filter((g) => families.includes(g.family)).map((g) => ({ ...g, items: online?.results.filter(g.test) ?? [] }))
  const shown = groups.filter((g) => g.items.length)

  return (
    <div className="searchpage">
      <header className="topbar sticky">
        <button type="button" className="icon-btn" aria-label="Retour" onClick={() => back('/')}>
          <Icon name="back" size={22} />
        </button>
        <form
          className="searchbox"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            input.current?.blur()
            run(q, families)
          }}
        >
          <Icon name="search" />
          <label className="sr" htmlFor="q">
            Titre, code-barre ou ISBN
          </label>
          <input ref={input} id="q" type="search" enterKeyHint="search" autoComplete="off" placeholder="Titre, code-barre ou ISBN…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button type="button" className="icon-btn small" aria-label="Effacer" onClick={() => (setQ(''), input.current?.focus())}>
              <Icon name="close" size={18} />
            </button>
          )}
        </form>
        <a className="icon-btn accent" href={`#/scan${wishlist ? '/wishlist' : ''}`} aria-label="Scanner un code-barre">
          <Icon name="scan" size={22} />
        </a>
      </header>

      <div className="page-head">
        <h1>{wishlist ? 'Ajouter à la wishlist' : 'Ajouter un jeu'}</h1>
      </div>

      {barcode && (
        <div className="notice">
          <Icon name="scan" size={20} />
          <span className="grow">
            Code <strong>{barcode}</strong> : il sera mémorisé avec le jeu choisi.
          </span>
          <button type="button" className="icon-btn small" aria-label="Oublier ce code" onClick={dropBarcode}>
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Où chercher en ligne">
        {(['all', ...FAMILIES] as Scope[]).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={scope === f} className={scope === f ? 'chip big on' : 'chip big'} onClick={() => setScope(f)}>
            {f === 'all' ? 'Tout' : familyLabel[f]}
          </button>
        ))}
      </div>

      {q.trim().length < 2 ? (
        <div className="search-help">
          <p>Tape un titre (en français ou en VO), un code-barre ou un ISBN. Ta collection s’affiche tout de suite, les sources en ligne juste après.</p>
          <div className="btn-row">
            <a className="btn primary" href={`#/scan${wishlist ? '/wishlist' : ''}`}>
              <Icon name="scan" size={18} /> Scanner une boîte
            </a>
            <button type="button" className="btn" onClick={manual}>
              <Icon name="edit" size={18} /> Saisie manuelle
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="block flat">
            <div className="group-head">
              <h2>Ma collection</h2>
              <span className="rule" />
              <span className="muted small">{local.length}</span>
            </div>
            {local.length ? (
              <div className="list">
                {local.map((g) => (
                  <LocalRow
                    key={g.id}
                    game={g}
                    action={{
                      label: '+ Exemplaire',
                      onClick: async () => {
                        await rememberCode(g)
                        go(`/jeu/${g.id}/exemplaire`)
                      },
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="muted small">Rien dans ta collection.</p>
            )}
          </section>

          <section className="block flat">
            <div className="group-head">
              <h2>En ligne</h2>
              <span className="rule" />
              {online?.loading && <span className="spinner" aria-label="Recherche en cours" />}
            </div>
            {online?.product && (
              <p className="muted small">
                Produit trouvé pour ce code : « {online.product} »
              </p>
            )}
            {online?.error && (
              <p className="alert" role="alert">
                {online.error}
              </p>
            )}
            {chooseError && (
              <p className="alert" role="alert">
                {chooseError}
              </p>
            )}
            {q.trim().length < 3 ? (
              <p className="muted small">Encore un caractère…</p>
            ) : online && !online.loading && !online.error && !shown.length ? (
              <p className="muted small">Aucun résultat en ligne.</p>
            ) : null}
            {shown.map((g) => {
              const all = more[g.key]
              const items = all ? g.items : g.items.slice(0, 6)
              return (
                <div key={g.key} className="online-group">
                  <h3 className="online-source">
                    {familyLong[g.family]} · {g.label}
                  </h3>
                  <div className="list">
                    {items.map((c) => (
                      <CandidateRow key={`${c.source}:${c.id}`} c={c} onChoose={choose} busy={busy === `${c.source}:${c.id}`} />
                    ))}
                  </div>
                  {g.items.length > items.length && (
                    <button type="button" className="link-btn" onClick={() => setMore({ ...more, [g.key]: true })}>
                      Voir les {g.items.length - items.length} autres
                    </button>
                  )}
                </div>
              )
            })}
            {online && <SourceErrors errors={online.errors} />}
          </section>

          <div className="search-foot">
            <span className="muted">Introuvable ?</span>
            <button type="button" className="btn" onClick={manual}>
              <Icon name="edit" size={18} /> Saisie manuelle
            </button>
          </div>
        </>
      )}
    </div>
  )
}
