import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { errMsg, fmtDate, fmtNum } from '@/lib/utils'
import type { PaymentSetting, Recharge } from '@/lib/types'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Skeleton, SuccessBox, Table, Td, Th } from '@/components/ui'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export default function AddFunds() {
  const { session } = useAuth()
  const { money, site } = useSite()
  const [methods, setMethods] = useState<PaymentSetting[]>([])
  const [history, setHistory] = useState<Recharge[]>([])
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [m, h] = await Promise.all([
      supabase.from('payment_settings').select('*').eq('is_enabled', true),
      supabase.from('recharge_requests').select('*').order('created_at', { ascending: false }).limit(50),
    ])
    setMethods((m.data ?? []) as PaymentSetting[]); setHistory((h.data ?? []) as Recharge[]); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const min = methods.length ? Math.min(...methods.map(m => Number(m.min_recharge))) : 0
  const credits = Number(amount) * Number(site.credits_per_currency_unit)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setOk(null)
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setErr('Enter a valid amount.')
    if (amt < min) return setErr(`Minimum recharge is ${money(min)}.`)
    if (ref.trim().length < 4) return setErr('Enter the transaction reference from your payment.')
    if (!file) return setErr('Attach your payment proof (screenshot or PDF).')
    if (!ALLOWED.includes(file.type)) return setErr('Proof must be a PNG, JPG, WEBP or PDF file.')
    if (file.size > MAX_BYTES) return setErr('Proof must be 5 MB or smaller.')
    if (!session) return

    setBusy(true)
    const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) { setBusy(false); return setErr(errMsg(up.error)) }

    const { error } = await supabase.from('recharge_requests').insert({ amount: amt, transaction_ref: ref.trim(), proof_path: path })
    setBusy(false)
    if (error) {
      await supabase.storage.from('payment-proofs').remove([path])
      return setErr(/duplicate|unique/i.test(error.message) ? 'That transaction reference was already submitted.' : errMsg(error))
    }
    setOk('Request submitted. Your balance updates only after an admin verifies the payment.')
    setAmount(''); setRef(''); setFile(null)
    ;(document.getElementById('proof') as HTMLInputElement | null)?.value && ((document.getElementById('proof') as HTMLInputElement).value = '')
    load()
  }

  return (
    <>
      <PageHeader title="Add funds" sub={`1 ${site.currency_code} = ${fmtNum(site.credits_per_currency_unit, 4)} credit(s)`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {loading ? <Skeleton className="h-48" /> : methods.length === 0 ? <Card><Empty title="Recharge is currently unavailable" hint="No payment method is enabled." /></Card> :
            methods.map(m => (
              <Card key={m.id}>
                <h2 className="font-semibold">{m.method_name}</h2>
                <dl className="mt-2 space-y-1 text-sm">
                  {m.account_holder && <div className="flex justify-between"><dt className="text-slate-500">Account holder</dt><dd>{m.account_holder}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Account details</dt><dd className="whitespace-pre-wrap text-right font-mono">{m.account_details}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Minimum</dt><dd>{money(m.min_recharge)}</dd></div>
                </dl>
                {m.instructions && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">{m.instructions}</p>}
              </Card>
            ))}
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">Submit payment proof</h2>
          <form onSubmit={submit} className="space-y-4">
            <ErrorBox message={err} /><SuccessBox message={ok} />
            <Field label={`Amount paid (${site.currency_code})`} hint={credits > 0 ? `You will receive ${fmtNum(credits)} credits once approved.` : undefined}>
              <Input type="number" min={0} step="any" value={amount} onChange={e => setAmount(e.target.value)} required />
            </Field>
            <Field label="Transaction reference / ID"><Input value={ref} onChange={e => setRef(e.target.value)} maxLength={100} required /></Field>
            <Field label="Payment proof" hint="PNG, JPG, WEBP or PDF, up to 5 MB">
              <input id="proof" type="file" accept={ALLOWED.join(',')} onChange={e => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            </Field>
            <Button type="submit" disabled={busy || methods.length === 0} className="w-full">{busy ? 'Submitting…' : 'Submit request'}</Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-semibold">Your recharge requests</h2>
        {history.length === 0 ? <Empty title="No requests yet" /> : (
          <Table><thead><tr><Th>Date</Th><Th>Amount</Th><Th>Reference</Th><Th>Status</Th><Th>Note</Th></tr></thead>
            <tbody>{history.map(r => (
              <tr key={r.id}><Td>{fmtDate(r.created_at)}</Td><Td>{money(r.amount)}</Td><Td className="font-mono text-xs">{r.transaction_ref}</Td>
                <Td><Badge status={r.status} /></Td><Td>{r.public_note ?? '—'}</Td></tr>))}</tbody></Table>
        )}
      </Card>
    </>
  )
}
