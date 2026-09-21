import { useEffect, useState } from 'react'
import { checkSupabase, type Diagnostic } from './lib/supabase'

function libelle(d: Diagnostic | null): string {
  if (!d) return 'Vérification…'
  if (d.etat === 'ok') return 'Connectée'
  if (d.etat === 'absent') return `Non configurée (variable manquante : ${d.manque.join(', ')})`
  return `Erreur : ${d.detail}`
}

export default function App() {
  const [diag, setDiag] = useState<Diagnostic | null>(null)

  useEffect(() => {
    checkSupabase().then(setDiag)
  }, [])

  const dot = !diag ? 'wait' : diag.etat === 'ok' ? 'ok' : 'ko'

  return (
    <main className="page">
      <img className="logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={72} height={72} />
      <h1>Ma Ludothèque</h1>
      <p className="intro">Le socle est en place. La collection arrive au lot 1.</p>

      <ul className="checks">
        <li>
          <span className="dot ok" /> Application publiée
        </li>
        <li>
          <span className={`dot ${dot}`} /> Base Supabase : {libelle(diag)}
        </li>
      </ul>

      <p className="hint">
        Sur téléphone : menu du navigateur → <strong>Ajouter à l'écran d'accueil</strong>.
      </p>
    </main>
  )
}
