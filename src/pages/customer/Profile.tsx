import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { errMsg, fmtDate } from '@/lib/utils'
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, SuccessBox } from '@/components/ui'

export default function Profile() {
  const { profile, refresh } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [pErr, setPErr] = useState<string | null>(null)
  const [pOk, setPOk] = useState<string | null>(null)

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [wErr, setWErr] = useState<string | null>(null)
  const [wOk, setWOk] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setPErr(null); setPOk(null)
    // Only full_name and phone are writable by customers (column-level grant). Role/status cannot be changed here.
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', profile.id)
    if (error) return setPErr(errMsg(error))
    setPOk('Profile updated.'); refresh()
  }

  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    setWErr(null); setWOk(null)
    if (pw.length < 8) return setWErr('Password must be at least 8 characters.')
    if (pw !== pw2) return setWErr('Passwords do not match.')
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return setWErr(error.message)
    setWOk('Password changed.'); setPw(''); setPw2('')
  }

  return (
    <>
      <PageHeader title="Profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Account</h2><Badge status={profile?.status ?? 'active'} />
          </div>
          <form onSubmit={save} className="space-y-4">
            <ErrorBox message={pErr} /><SuccessBox message={pOk} />
            <Field label="Email"><Input value={profile?.email ?? ''} disabled /></Field>
            <Field label="Full name"><Input value={name} onChange={e => setName(e.target.value)} required /></Field>
            <Field label="Phone"><Input value={phone} onChange={e => setPhone(e.target.value)} /></Field>
            <p className="text-xs text-slate-500">Member since {profile ? fmtDate(profile.created_at) : ''}</p>
            <Button type="submit">Save changes</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Change password</h2>
          <form onSubmit={changePw} className="space-y-4">
            <ErrorBox message={wErr} /><SuccessBox message={wOk} />
            <Field label="New password"><Input type="password" minLength={8} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" required /></Field>
            <Field label="Confirm new password"><Input type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" required /></Field>
            <Button type="submit">Update password</Button>
          </form>
        </Card>
      </div>
    </>
  )
}
