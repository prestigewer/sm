import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button, ErrorBox, Field, Input, SuccessBox } from '@/components/ui'
import { AuthShell } from './AuthShell'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // The recovery link signs the user in with a recovery session.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (e === 'PASSWORD_RECOVERY' || s) setReady(true) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (password.length < 8) return setErr('Password must be at least 8 characters.')
    if (password !== confirm) return setErr('Passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setErr(error.message)
    setInfo('Password updated. Redirecting…')
    setTimeout(() => navigate('/dashboard', { replace: true }), 1200)
  }

  return (
    <AuthShell title="Choose a new password">
      {!ready ? <ErrorBox message="This reset link is invalid or has expired. Request a new one from the login page." /> : (
        <form onSubmit={submit} className="space-y-4">
          <ErrorBox message={err} /><SuccessBox message={info} />
          <Field label="New password"><Input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm password"><Input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</Button>
        </form>
      )}
    </AuthShell>
  )
}
