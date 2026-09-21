import { useEffect, useState } from 'react'
import { checkSupabase } from './lib/supabase'

type Etat = 'verif' | 'ok' | 'absent' | 'erreur'

const libelles: Record<Etat, string> = {
  verif: 'Vérification…',
  ok: 'Connectée',
  absent: 'Non configurée (variables GitHub manquantes)',
  erreur: 'Injoignable (URL ou clé à vérifier)',
}

export default function App() {
  const [etat, setEtat] = useState<Etat>('verif')

  useEffect(() => {
    checkSupabase().then(setEtat)
  }, [])

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
          <span className={`dot ${etat === 'ok' ? 'ok' : etat === 'verif' ? 'wait' : 'ko'}`} /> Base Supabase :{' '}
          {libelles[etat]}
        </li>
      </ul>

      <p className="hint">
        Sur téléphone : menu du navigateur → <strong>Ajouter à l'écran d'accueil</strong>.
      </p>
    </main>
  )
}
