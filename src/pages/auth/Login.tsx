import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { errMsg } from '@/lib/utils'
import { Button, ErrorBox, Field, Input } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setErr(error.message)
    navigate(loc.state?.from ?? '/dashboard', { replace: true })
  }

  return (
    <AuthShell title="Welcome back" sub="Log in to manage your orders and wallet.">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={err} />
        <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</Button>
      </form>
      <div className="flex justify-between text-sm">
        <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
        <Link to="/register" className="text-brand-600 hover:underline">Create account</Link>
      </div>
    </AuthShell>
  )
}
