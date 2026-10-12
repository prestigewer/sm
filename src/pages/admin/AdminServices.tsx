import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { errMsg, fmtNum } from '@/lib/utils'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, TableSkeleton, Table, Td, Textarea, Th } from '@/components/ui'

const BLANK = {
  id: '', category_id: '', name: '', description: '', supplier_rate: '', customer_rate: '', min_qty: '100', max_qty: '10000',
  est_time: '', refill_policy: '', cancel_policy: '', is_active: true,
}
const DEFAULT_PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook']

export default function AdminServices() {
  const { money } = useSite()
  const [services, setServices] = useState<any[]>([])
  const [cats, setCats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof BLANK | null>(null)
  const [catForm, setCatForm] = useState<{ platform: string; name: string } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from('services').select('*, service_categories(platform,name)').order('created_at', { ascending: false }),
      supabase.from('service_categories').select('*').order('platform').order('name'),
    ])
    setServices(s.data ?? []); setCats(c.data ?? []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k: keyof typeof BLANK, v: string | boolean) => setForm(f => f && { ...f, [k]: v })
  const sup = Number(form?.supplier_rate), cus = Number(form?.customer_rate)
  const profit = cus - sup
  const margin = cus > 0 ? (profit / cus) * 100 : 0

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setErr(null)
    const payload = {
      category_id: form.category_id, name: form.name.trim(), description: form.description.trim(),
      supplier_rate: Number(form.supplier_rate), customer_rate: Number(form.customer_rate),
      min_qty: Number(form.min_qty), max_qty: Number(form.max_qty), est_time: form.est_time.trim(),
      refill_policy: form.refill_policy.trim(), cancel_policy: form.cancel_policy.trim(), is_active: form.is_active,
    }
    if (!payload.category_id) return setErr('Choose a category.')
    if (payload.max_qty < payload.min_qty) return setErr('Max quantity must be at least min quantity.')
    if (payload.customer_rate < payload.supplier_rate && !confirm('Selling price is below supplier cost — you will lose money on every order. Save anyway?')) return
    setBusy(true)
    const { error } = form.id
      ? await supabase.from('services').update(payload).eq('id', form.id)
      : await supabase.from('services').insert(payload)
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setForm(null); load()
  }

  const toggle = async (s: any) => { await supabase.from('services').update({ is_active: !s.is_active }).eq('id', s.id); load() }
  const remove = async (s: any) => {
    if (!confirm(`Delete "${s.name}"? Services with existing orders cannot be deleted — disable them instead.`)) return
    const { error } = await supabase.from('services').delete().eq('id', s.id)
    if (error) alert(/foreign key|violates/i.test(error.message) ? 'This service has orders and cannot be deleted. Disable it instead.' : error.message)
    load()
  }

  const saveCat = async (e: FormEvent) => {
    e.preventDefault()
    if (!catForm) return
    setErr(null); setBusy(true)
    const { error } = await supabase.from('service_categories').insert({ platform: catForm.platform.trim(), name: catForm.name.trim() })
    setBusy(false)
    if (error) return setErr(/duplicate|unique/i.test(error.message) ? 'That category already exists for this platform.' : errMsg(error))
    setCatForm(null); load()
  }
  const toggleCat = async (c: any) => { await supabase.from('service_categories').update({ is_active: !c.is_active }).eq('id', c.id); load() }

  const platforms = [...new Set([...DEFAULT_PLATFORMS, ...cats.map(c => c.platform)])]

  return (
    <>
      <PageHeader title="Services" sub="Rates are per 1,000 units. Supplier rates are visible to admins only."
        actions={<>
          <Button variant="outline" onClick={() => { setErr(null); setCatForm({ platform: 'TikTok', name: '' }) }}><Plus className="h-4 w-4" />Category</Button>
          <Button onClick={() => { setErr(null); setForm({ ...BLANK, category_id: cats[0]?.id ?? '' }) }}><Plus className="h-4 w-4" />Service</Button>
        </>} />

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {cats.length === 0 && <p className="text-sm text-slate-500">Create a platform category first (e.g. TikTok → Likes).</p>}
          {cats.map(c => (
            <button key={c.id} onClick={() => toggleCat(c)} title="Click to enable/disable"
              className={`rounded-full border px-3 py-1 text-xs ${c.is_active ? '' : 'line-through opacity-50'}`}>{c.platform} · {c.name}</button>
          ))}
        </div>
      </Card>

      <Card>
        {loading ? <TableSkeleton /> : services.length === 0 ? <Empty title="No services yet" hint="Add a category, then a service." /> : (
          <Table>
            <thead><tr><Th>Service</Th><Th>Category</Th><Th>Supplier</Th><Th>Customer</Th><Th>Profit / margin</Th><Th>Min–Max</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{services.map(s => {
              const p = Number(s.customer_rate) - Number(s.supplier_rate)
              const m = Number(s.customer_rate) > 0 ? (p / Number(s.customer_rate)) * 100 : 0
              return (
                <tr key={s.id}>
                  <Td className="font-medium">{s.name}</Td><Td>{s.service_categories?.platform} · {s.service_categories?.name}</Td>
                  <Td>{money(s.supplier_rate)}</Td><Td>{money(s.customer_rate)}</Td>
                  <Td><span className={p < 0 ? 'text-red-600' : 'text-emerald-600'}>{money(p)} ({fmtNum(m, 1)}%)</span></Td>
                  <Td>{fmtNum(s.min_qty)}–{fmtNum(s.max_qty)}</Td>
                  <Td><button onClick={() => toggle(s)} aria-label="Toggle"><Badge status={s.is_active ? 'active' : 'suspended'} /></button></Td>
                  <Td><div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => { setErr(null); setForm({ ...BLANK, ...s, supplier_rate: String(s.supplier_rate), customer_rate: String(s.customer_rate), min_qty: String(s.min_qty), max_qty: String(s.max_qty) }) }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => remove(s)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div></Td>
                </tr>)
            })}</tbody>
          </Table>
        )}
      </Card>

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={form?.id ? 'Edit service' : 'New service'}>
        {form && (
          <form onSubmit={save} className="space-y-4">
            <ErrorBox message={err} />
            <Field label="Category"><Select value={form.category_id} onChange={e => set('category_id', e.target.value)} required>
              <option value="">Select…</option>{cats.map(c => <option key={c.id} value={c.id}>{c.platform} · {c.name}</option>)}</Select></Field>
            <Field label="Name"><Input value={form.name} onChange={e => set('name', e.target.value)} required /></Field>
            <Field label="Description"><Textarea value={form.description} onChange={e => set('description', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier cost / 1,000"><Input type="number" min={0} step="any" value={form.supplier_rate} onChange={e => set('supplier_rate', e.target.value)} required /></Field>
              <Field label="Customer price / 1,000"><Input type="number" min={0} step="any" value={form.customer_rate} onChange={e => set('customer_rate', e.target.value)} required /></Field>
            </div>
            {form.supplier_rate !== '' && form.customer_rate !== '' && (
              <p className={`text-sm ${profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>Expected profit per 1,000: {money(profit)} ({fmtNum(margin, 1)}% margin)</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Min quantity"><Input type="number" min={1} value={form.min_qty} onChange={e => set('min_qty', e.target.value)} required /></Field>
              <Field label="Max quantity"><Input type="number" min={1} value={form.max_qty} onChange={e => set('max_qty', e.target.value)} required /></Field>
            </div>
            <Field label="Estimated processing time"><Input value={form.est_time} onChange={e => set('est_time', e.target.value)} placeholder="e.g. 0–6 hours" /></Field>
            <Field label="Refill policy"><Input value={form.refill_policy} onChange={e => set('refill_policy', e.target.value)} placeholder="e.g. 30-day refill" /></Field>
            <Field label="Cancellation policy"><Input value={form.cancel_policy} onChange={e => set('cancel_policy', e.target.value)} placeholder="e.g. Cancel only before processing" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />Service enabled</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save service'}</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!catForm} onClose={() => setCatForm(null)} title="New category">
        {catForm && (
          <form onSubmit={saveCat} className="space-y-4">
            <ErrorBox message={err} />
            <Field label="Platform" hint="Pick one or type a new platform name">
              <Input list="platforms" value={catForm.platform} onChange={e => setCatForm({ ...catForm, platform: e.target.value })} required />
              <datalist id="platforms">{platforms.map(p => <option key={p} value={p} />)}</datalist>
            </Field>
            <Field label="Category name"><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder="Likes, Followers, Views…" required /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCatForm(null)}>Cancel</Button><Button type="submit" disabled={busy}>Create</Button></div>
          </form>
        )}
      </Modal>
    </>
  )
}
