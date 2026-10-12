import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errMsg } from '@/lib/utils'
import type { PaymentSetting } from '@/lib/types'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Skeleton, Textarea } from '@/components/ui'

const BLANK = { id: '', method_name: '', account_holder: '', account_details: '', instructions: '', supported_currencies: 'PKR', min_recharge: '100', is_enabled: true }

export default function AdminPayments() {
  const [rows, setRows] = useState<PaymentSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof BLANK | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('payment_settings').select('*').order('created_at')
    setRows((data ?? []) as PaymentSetting[]); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k: keyof typeof BLANK, v: string | boolean) => setForm(f => f && { ...f, [k]: v })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setErr(null); setBusy(true)
    const payload = {
      method_name: form.method_name.trim(), account_holder: form.account_holder.trim(), account_details: form.account_details.trim(),
      instructions: form.instructions.trim(), min_recharge: Number(form.min_recharge), is_enabled: form.is_enabled,
      supported_currencies: form.supported_currencies.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
    }
    const { error } = form.id ? await supabase.from('payment_settings').update(payload).eq('id', form.id) : await supabase.from('payment_settings').insert(payload)
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setForm(null); load()
  }

  const remove = async (r: PaymentSetting) => {
    if (!confirm(`Delete "${r.method_name}"?`)) return
    await supabase.from('payment_settings').delete().eq('id', r.id); load()
  }

  return (
    <>
      <PageHeader title="Payment settings" sub="Everything here is shown to customers on the Add Funds page. Put only public payment details here — never passwords, PINs or API keys."
        actions={<Button onClick={() => { setErr(null); setForm({ ...BLANK }) }}><Plus className="h-4 w-4" />Method</Button>} />
      {loading ? <Skeleton className="h-40" /> : rows.length === 0 ? <Card><Empty title="No payment methods" hint="Customers can't recharge until you enable one." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(r => (
            <Card key={r.id}>
              <div className="flex items-start justify-between"><h2 className="font-semibold">{r.method_name}</h2><Badge status={r.is_enabled ? 'active' : 'suspended'} /></div>
              <p className="mt-1 text-sm text-slate-500">{r.account_holder}</p>
              <p className="mt-2 whitespace-pre-wrap font-mono text-sm">{r.account_details}</p>
              <p className="mt-2 text-xs text-slate-500">Min {r.min_recharge} · {r.supported_currencies.join(', ')}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setErr(null); setForm({ ...BLANK, ...r, min_recharge: String(r.min_recharge), supported_currencies: r.supported_currencies.join(', ') }) }}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(r)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={form?.id ? 'Edit payment method' : 'New payment method'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <ErrorBox message={err} />
            <Field label="Method name"><Input value={form.method_name} onChange={e => set('method_name', e.target.value)} placeholder="Bank transfer, JazzCash, Easypaisa…" required /></Field>
            <Field label="Account holder name"><Input value={form.account_holder} onChange={e => set('account_holder', e.target.value)} /></Field>
            <Field label="Account / IBAN / number (public)"><Textarea value={form.account_details} onChange={e => set('account_details', e.target.value)} required /></Field>
            <Field label="Instructions for customers"><Textarea value={form.instructions} onChange={e => set('instructions', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Supported currencies" hint="Comma separated"><Input value={form.supported_currencies} onChange={e => set('supported_currencies', e.target.value)} /></Field>
              <Field label="Minimum recharge"><Input type="number" min={0} step="any" value={form.min_recharge} onChange={e => set('min_recharge', e.target.value)} required /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_enabled} onChange={e => set('is_enabled', e.target.checked)} />Enabled</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Save</Button></div>
          </form>
        )}
      </Modal>
    </>
  )
}
