import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { errMsg, fmtDate, fmtNum } from '@/lib/utils'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Skeleton, SuccessBox, Textarea } from '@/components/ui'

const EDITABLE = ['pending', 'processing', 'completed', 'partial', 'failed', 'cancelled']

export default function AdminOrderDetail() {
  const { id } = useParams()
  const { money } = useSite()
  const [o, setO] = useState<any>(null)
  const [priv, setPriv] = useState<any>(null)
  const [hist, setHist] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('pending')
  const [supplier, setSupplier] = useState('')
  const [extId, setExtId] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundAmt, setRefundAmt] = useState('')
  const [refundNote, setRefundNote] = useState('')

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('orders').select('*, profiles(id,full_name,email)').eq('id', id).maybeSingle(),
      supabase.from('order_private').select('*').eq('order_id', id).maybeSingle(),
      supabase.from('order_status_history').select('*').eq('order_id', id).order('created_at'),
    ])
    const ord = a.data as any
    setO(ord); setPriv(b.data); setHist(c.data ?? []); setLoading(false)
    if (ord) setStatus(ord.status === 'refunded' ? 'cancelled' : ord.status)
    if (b.data) { setSupplier(b.data.supplier_name ?? ''); setExtId(b.data.external_order_id ?? ''); setCost(String(b.data.supplier_cost ?? '')); setNote(b.data.internal_note ?? '') }
  }, [id])
  useEffect(() => { load() }, [load])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setOk(null); setBusy(true)
    const { error } = await supabase.rpc('admin_update_order', {
      p_order: id, p_status: status, p_supplier_name: supplier.trim() || null, p_external_id: extId.trim() || null,
      p_supplier_cost: cost === '' ? null : Number(cost), p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setOk('Order updated.'); load()
  }

  const refund = async () => {
    setErr(null); setOk(null); setBusy(true)
    const { error } = await supabase.rpc('admin_refund_order', { p_order: id, p_amount: Number(refundAmt), p_note: refundNote.trim() || null })
    setBusy(false); setRefundOpen(false)
    if (error) return setErr(errMsg(error))
    setOk('Refund issued and recorded in the ledger.'); load()
  }

  if (loading) return <Skeleton className="h-72" />
  if (!o) return <Card>Order not found.</Card>

  const locked = o.status === 'refunded'
  const refundable = Number(o.refunded_amount) === 0
  const profit = Number(o.customer_price) - Number(o.refunded_amount) - Number(priv?.supplier_cost ?? 0)

  return (
    <>
      <Link to="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Orders</Link>
      <PageHeader title={`Order #${o.order_no}`} actions={<Badge status={o.status} />} />
      {o.cancel_requested && !locked && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">The customer requested cancellation. Nothing is refunded automatically — set the status and issue a refund if eligible.</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Order</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Customer</dt><dd><Link className="text-brand-600 hover:underline" to={`/admin/customers/${o.profiles?.id}`}>{o.profiles?.full_name || o.profiles?.email}</Link></dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Service</dt><dd>{o.service_name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Link</dt><dd className="break-all text-right"><a className="text-brand-600 hover:underline" href={o.target_url} target="_blank" rel="noopener noreferrer">{o.target_url}</a></dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Quantity</dt><dd>{fmtNum(o.quantity)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Charged</dt><dd>{money(o.customer_price)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Refunded</dt><dd>{money(o.refunded_amount)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Supplier cost</dt><dd>{money(priv?.supplier_cost ?? 0)}</dd></div>
            <div className="flex justify-between border-t pt-2 font-semibold"><dt>Gross profit</dt><dd>{money(profit)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Placed</dt><dd>{fmtDate(o.created_at)}</dd></div>
          </dl>
          <h3 className="mb-2 mt-5 text-sm font-semibold">History</h3>
          <ul className="space-y-1 text-sm">{hist.map(h => <li key={h.id}><Badge status={h.new_status} /> <span className="text-xs text-slate-500">{fmtDate(h.created_at)}{h.note ? ` — ${h.note}` : ''}</span></li>)}</ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Fulfilment</h2>
          <form onSubmit={save} className="space-y-4">
            <ErrorBox message={err} /><SuccessBox message={ok} />
            <Field label="Status">
              <Select value={status} onChange={e => setStatus(e.target.value)} disabled={locked}>
                {EDITABLE.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier name"><Input value={supplier} onChange={e => setSupplier(e.target.value)} disabled={locked} /></Field>
              <Field label="Supplier order ID"><Input value={extId} onChange={e => setExtId(e.target.value)} disabled={locked} /></Field>
            </div>
            <Field label="Supplier cost" hint="Pre-filled from the service's supplier rate; adjust to the actual amount paid.">
              <Input type="number" min={0} step="any" value={cost} onChange={e => setCost(e.target.value)} disabled={locked} />
            </Field>
            <Field label="Internal note (never shown to customer)"><Textarea value={note} onChange={e => setNote(e.target.value)} disabled={locked} /></Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || locked}>Save changes</Button>
              <Button type="button" variant="danger" disabled={!refundable || locked} onClick={() => { setRefundAmt(String(o.customer_price)); setRefundOpen(true) }}>Refund…</Button>
            </div>
            {!refundable && !locked && <p className="text-xs text-slate-500">A partial refund was already issued; further refunds are blocked.</p>}
          </form>
        </Card>
      </div>

      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Refund order">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Credits return to the customer's wallet once. Maximum {money(o.customer_price)}. This cannot be undone.</p>
          <Field label="Refund amount"><Input type="number" min={0} max={o.customer_price} step="any" value={refundAmt} onChange={e => setRefundAmt(e.target.value)} /></Field>
          <Field label="Reason"><Input value={refundNote} onChange={e => setRefundNote(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button><Button variant="danger" onClick={refund} disabled={busy || !(Number(refundAmt) > 0)}>Issue refund</Button></div>
        </div>
      </Modal>
    </>
  )
}
