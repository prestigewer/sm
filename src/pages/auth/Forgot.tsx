import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button, ErrorBox, Field, Input, SuccessBox } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function Forgot() {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setInfo(null); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/reset-password' })
    setBusy(false)
    if (error) return setErr(error.message)
    setInfo('If an account exists for that email, a reset link has been sent.')
  }

  return (
    <AuthShell title="Reset your password" sub="We'll email you a reset link.">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox message={err} /><SuccessBox message={info} />
        <Field label="Email"><Input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
      </form>
      <Link to="/login" className="text-sm text-brand-600 hover:underline">Back to log in</Link>
    </AuthShell>
  )
}
