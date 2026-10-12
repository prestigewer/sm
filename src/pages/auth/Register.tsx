import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button, ErrorBox, Field, Input, SuccessBox } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setInfo(null)
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + '/login' },
    })
    setBusy(false)
    if (error) return setErr(error.message)
    if (data.session) navigate('/dashboard', { replace: true })
    else setInfo('Account created. Check your email to verify your address, then log in.')
  }

  return (
    <AuthShell title="Create your account" sub="Start ordering in minutes.">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={err} /><SuccessBox message={info} />
        <Field label="Full name"><Input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label="Email"><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>
        <Field label="Password" hint="At least 8 characters"><Input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</Button>
      </form>
      <p className="text-sm">Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Log in</Link></p>
    </AuthShell>
  )
}
