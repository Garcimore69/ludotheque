import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { CandidateRow, LocalRow, SourceErrors, useChoose } from '../components/Online'
import { localPlatforms, platformFromHint } from '../lib/labels'
import { cleanCode, gamesByCode, localSearch, lookupBarcode, setPending, validEan, type BarcodeAnswer } from '../lib/online'
import { back, go } from '../lib/router'
import { useStore } from '../lib/store'
import type { Game } from '../lib/types'

// L'API BarcodeDetector (Chrome Android, Safari récent) n'est pas encore dans les types TypeScript.
interface Detected {
  rawValue: string
}
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<Detected[]>
}
interface DetectorCtor {
  new (opts: { formats: string[] }): NativeDetector
  getSupportedFormats(): Promise<string[]>
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

type CamState = 'starting' | 'on' | 'denied' | 'unavailable'

/** Caméra arrière + lecture continue du code-barre (natif, sinon ZXing chargé à la demande). */
function Camera({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<CamState>('starting')
  const [engine, setEngine] = useState<string>('')
  const [torch, setTorch] = useState<{ track: MediaStreamTrack; on: boolean } | null>(null)
  const cb = useRef(onCode)
  cb.current = onCode

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let zx: { stop: () => void } | null = null
    const seen = new Map<string, number>()

    // Un code n'est retenu qu'après deux lectures identiques (trois si la clé de contrôle ne colle pas).
    const accept = (raw: string) => {
      const code = cleanCode(raw)
      if (code.length < 8 || stopped) return
      const n = (seen.get(code) ?? 0) + 1
      seen.set(code, n)
      if (n >= (validEan(code) ? 2 : 3)) {
        stopped = true
        navigator.vibrate?.(60)
        cb.current(code)
      }
    }

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (e) {
        setState((e as DOMException).name === 'NotAllowedError' ? 'denied' : 'unavailable')
        return
      }
      if (stopped || !video.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const v = video.current
      v.srcObject = stream
      await v.play().catch(() => {})
      setState('on')

      const track = stream.getVideoTracks()[0]
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
      if (caps.torch) setTorch({ track, on: false })

      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
      const formats = Native ? await Native.getSupportedFormats().catch(() => [] as string[]) : []
      if (Native && formats.includes('ean_13')) {
        setEngine('natif')
        const det = new Native({ formats: FORMATS.filter((f) => formats.includes(f)) })
        const tick = async () => {
          if (stopped) return
          try {
            if (v.readyState >= 2) for (const b of await det.detect(v)) accept(b.rawValue)
          } catch {
            /* image pas encore prête */
          }
          timer = setTimeout(tick, 120)
        }
        tick()
      } else {
        setEngine('ZXing')
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
        if (stopped) return
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E])
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80 })
        zx = await reader.decodeFromVideoElement(v, (res) => {
          if (res) accept(res.getText())
        })
        if (stopped) zx.stop()
      }
    })()

    return () => {
      stopped = true
      clearTimeout(timer)
      zx?.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const toggleTorch = async () => {
    if (!torch) return
    const on = !torch.on
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorch({ ...torch, on })
    } catch {
      setTorch(null)
    }
  }

  return (
    <div className="camera">
      <video ref={video} playsInline muted aria-label="Aperçu de la caméra" />
      <div className="camera-frame" aria-hidden="true">
        <span className="camera-line" />
      </div>
      <p className="camera-status" role="status">
        {state === 'starting' && 'Ouverture de la caméra…'}
        {state === 'on' && 'Vise le code-barre, bien à plat et éclairé.'}
        {state === 'denied' && 'Accès à la caméra refusé : autorise-le dans les réglages du navigateur, ou tape le code ci-dessous.'}
        {state === 'unavailable' && 'Caméra indisponible sur cet appareil : tape le code ci-dessous.'}
      </p>
      {torch && (
        <button type="button" className={torch.on ? 'icon-btn camera-torch on' : 'icon-btn camera-torch'} aria-pressed={torch.on} aria-label="Lampe" onClick={toggleTorch}>
          <Icon name="bolt" size={22} />
        </button>
      )}
      {engine && <span className="camera-engine">lecteur {engine}</span>}
    </div>
  )
}

/** Associe le code scanné à un jeu déjà dans la collection (typiquement les JV importés sans EAN). */
function Attach({ onPick }: { onPick: (g: Game) => void }) {
  const { games } = useStore()
  const [q, setQ] = useState('')
  const list = useMemo(() => localSearch(games.values(), q, 6), [games, q])
  return (
    <div className="attach">
      <label className="searchbox">
        <Icon name="search" />
        <span className="sr">Chercher dans ma collection</span>
        <input type="search" autoFocus placeholder="Chercher dans ma collection…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="list">
        {list.map((g) => (
          <LocalRow key={g.id} game={g} action={{ label: 'Associer', onClick: () => onPick(g) }} />
        ))}
      </div>
    </div>
  )
}

export function ScanPage({ wishlist }: { wishlist: boolean }) {
  const { games, ready } = useStore()
  const [code, setCode] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [answer, setAnswer] = useState<BarcodeAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attach, setAttach] = useState(false)
  const [done, setDone] = useState<Game | null>(null)
  const [online, setOnline] = useState(false)
  const hint = answer?.product?.platform ?? null
  const { choose, busy, error: chooseError, rememberCode } = useChoose({ barcode: code ?? undefined, wishlist, platformHint: hint })

  const local = useMemo(() => (code ? gamesByCode(games.values(), code) : []), [games, code])

  // Rien en local : on interroge les sources en ligne
  useEffect(() => {
    if (!code || !ready) return
    if (local.length && !online) return
    let alive = true
    setLoading(true)
    setError(null)
    lookupBarcode(code)
      .then((r) => alive && setAnswer(r))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, ready, online])

  const reset = () => {
    setCode(null)
    setAnswer(null)
    setError(null)
    setAttach(false)
    setDone(null)
    setOnline(false)
    setTyped('')
  }

  const submitTyped = (e: FormEvent) => {
    e.preventDefault()
    const c = cleanCode(typed)
    if (c.length >= 8) setCode(c)
  }

  const manual = () => {
    setPending({ barcode: code ?? undefined, wishlist, platformHint: hint })
    go(`/ajout/manuel${wishlist ? '/wishlist' : ''}`)
  }

  const byTitle = () => {
    const p = new URLSearchParams()
    if (answer?.product?.query) p.set('q', answer.product.query)
    if (code) p.set('code', code)
    go(`/ajout${wishlist ? '/wishlist' : ''}?${p}`)
  }

  const attachTo = async (g: Game) => {
    try {
      await rememberCode(g)
      setDone(g)
      setAttach(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Résultats : ceux qui tournent sur la plateforme devinée d'abord
  const wanted = platformFromHint(hint)
  const candidates = [...(answer?.candidates ?? [])].sort(
    (a, b) => Number(b.exact) - Number(a.exact) || Number(!!wanted && localPlatforms(b.platforms).includes(wanted)) - Number(!!wanted && localPlatforms(a.platforms).includes(wanted)),
  )

  return (
    <div className="scanpage">
      <header className="scan-top">
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => back('/')}>
          <Icon name="close" size={22} />
        </button>
        <h1>{wishlist ? 'Scanner pour la wishlist' : 'Scanner un jeu'}</h1>
        <a className="icon-btn" href={`#/ajout${wishlist ? '/wishlist' : ''}`} aria-label="Chercher par titre">
          <Icon name="search" size={22} />
        </a>
      </header>

      {!code ? (
        <>
          <Camera onCode={setCode} />
          <form className="scan-type" onSubmit={submitTyped}>
            <label className="sr" htmlFor="code">
              Code-barre ou ISBN
            </label>
            <input id="code" className="input" inputMode="numeric" autoComplete="off" placeholder="…ou tape le code (EAN, ISBN)" value={typed} onChange={(e) => setTyped(e.target.value)} />
            <button type="submit" className="btn primary" disabled={cleanCode(typed).length < 8}>
              Chercher
            </button>
          </form>
        </>
      ) : (
        <div className="scan-result">
          <div className="scan-code">
            <Icon name="scan" size={22} />
            <span className="grow scan-code-txt">
              <span className="muted small">Code scanné</span>
              <strong>{code}</strong>
            </span>
            <button type="button" className="btn small" onClick={reset}>
              <Icon name="refresh" size={18} /> Rescanner
            </button>
          </div>

          {done ? (
            <div className="notice ok">
              <Icon name="check" size={20} />
              <span className="grow">
                Code mémorisé pour <strong>{done.title}</strong> : le prochain scan le trouvera directement.
              </span>
              <a className="btn small" href={`#/jeu/${done.id}`}>
                Voir la fiche
              </a>
            </div>
          ) : (
            <>
              {local.length > 0 && (
                <section className="block flat">
                  <div className="group-head">
                    <h2>Déjà dans ma collection</h2>
                    <span className="rule" />
                  </div>
                  <div className="list">
                    {local.map((g) => (
                      <LocalRow key={g.id} game={g} action={{ label: '+ Exemplaire', onClick: () => go(`/jeu/${g.id}/exemplaire`) }} />
                    ))}
                  </div>
                  {!online && (
                    <button type="button" className="link-btn" onClick={() => setOnline(true)}>
                      Chercher quand même en ligne
                    </button>
                  )}
                </section>
              )}

              {(!local.length || online) && (
                <section className="block flat">
                  <div className="group-head">
                    <h2>En ligne</h2>
                    <span className="rule" />
                    {loading && <span className="spinner" aria-label="Recherche en cours" />}
                  </div>
                  {error && (
                    <p className="alert" role="alert">
                      {error}
                    </p>
                  )}
                  {chooseError && (
                    <p className="alert" role="alert">
                      {chooseError}
                    </p>
                  )}
                  {answer?.product && (
                    <p className="muted small">
                      Produit : « {answer.product.title} »{wanted ? ` · ${wanted}` : ''}
                    </p>
                  )}
                  {answer && !loading && !candidates.length && <p className="muted">Aucune source ne connaît ce code.</p>}
                  {candidates.length > 0 && (
                    <div className="list">
                      {candidates.slice(0, 12).map((c) => (
                        <CandidateRow key={`${c.source}:${c.id}`} c={c} onChoose={choose} busy={busy === `${c.source}:${c.id}`} />
                      ))}
                    </div>
                  )}
                  {answer && <SourceErrors errors={answer.errors} />}
                </section>
              )}

              {!loading && (
                <section className="block flat scan-next">
                  <h2>Pas le bon jeu ?</h2>
                  <div className="btn-row">
                    <button type="button" className="btn" onClick={byTitle}>
                      <Icon name="search" size={18} /> Chercher par titre
                    </button>
                    <button type="button" className={attach ? 'btn active' : 'btn'} onClick={() => setAttach(!attach)} aria-expanded={attach}>
                      <Icon name="collection" size={18} /> C’est un jeu de ma collection
                    </button>
                    <button type="button" className="btn" onClick={manual}>
                      <Icon name="edit" size={18} /> Saisie manuelle
                    </button>
                  </div>
                  {attach && <Attach onPick={attachTo} />}
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
