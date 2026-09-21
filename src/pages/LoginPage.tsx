import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const login = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setMsg({ ok: false, text: error.message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : error.message })
  }

  const magic = async () => {
    if (!supabase || !email.trim()) {
      setMsg({ ok: false, text: 'Saisis d’abord ton e-mail.' })
      return
    }
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setBusy(false)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Lien envoyé : ouvre l’e-mail sur cet appareil.' })
  }

  return (
    <main className="login">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={64} height={64} className="login-logo" />
      <h1>Ma Ludothèque</h1>
      {!supabase ? (
        <p className="alert">Supabase n’est pas configuré (variables VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).</p>
      ) : (
        <form onSubmit={login} className="login-form">
          <label className="field">
            <span className="field-label">E-mail</span>
            <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Mot de passe</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          <button type="button" className="link-btn" onClick={magic} disabled={busy}>
            Recevoir plutôt un lien de connexion par e-mail
          </button>
          {msg && (
            <p className={msg.ok ? 'ok-msg' : 'alert'} role="status">
              {msg.text}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
