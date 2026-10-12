import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { errMsg, fmtNum, isValidUrl, priceFor } from '@/lib/utils'
import type { PublicService } from '@/lib/types'
import { Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Skeleton } from '@/components/ui'

export default function NewOrder() {
  const { balance, refresh, profile } = useAuth()
  const { money } = useSite()
  const [params] = useSearchParams()
  const [services, setServices] = useState<PublicService[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('')
  const [serviceId, setServiceId] = useState(params.get('service') ?? '')
  const [url, setUrl] = useState('')
  const [qty, setQty] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [placed, setPlaced] = useState<{ id: string; no: number } | null>(null)

  useEffect(() => {
    supabase.from('services_public').select('*').order('name').then(({ data }) => {
      const rows = (data ?? []) as PublicService[]
      setServices(rows)
      const pre = rows.find(r => r.id === params.get('service'))
      if (pre) setPlatform(pre.platform)
      setLoading(false)
    })
  }, [params])

  const platforms = useMemo(() => [...new Set(services.map(s => s.platform))], [services])
  const options = services.filter(s => !platform || s.platform === platform)
  const svc = services.find(s => s.id === serviceId)
  const q = Number(qty)

  const errors = {
    service: touched && !svc ? 'Select a service.' : '',
    url: touched && !isValidUrl(url) ? 'Enter a valid link starting with http:// or https://' : '',
    qty: touched && svc && (!Number.isInteger(q) || q < svc.min_qty || q > svc.max_qty)
      ? `Quantity must be a whole number between ${fmtNum(svc.min_qty)} and ${fmtNum(svc.max_qty)}.` : '',
  }
  const total = svc && Number.isInteger(q) && q > 0 ? priceFor(svc.customer_rate, q) : 0
  const insufficient = total > balance
  const valid = !!svc && isValidUrl(url) && !errors.qty && Number.isInteger(q) && q > 0

  const review = () => {
    setTouched(true); setErr(null)
    if (valid) setConfirm(true)
  }

  const place = async () => {
    if (!svc) return
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('place_order', { p_service_id: svc.id, p_target_url: url.trim(), p_quantity: q })
    setBusy(false)
    setConfirm(false)
    if (error) return setErr(errMsg(error))
    const { data: o } = await supabase.from('orders').select('id,order_no').eq('id', data).single()
    setPlaced({ id: String(data), no: Number(o?.order_no ?? 0) })
    refresh()
  }

  if (profile?.status === 'suspended') return <ErrorBox message="Your account is suspended." />

  if (placed) return (
    <Card className="mx-auto max-w-lg text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h2 className="mt-3 text-xl font-bold">Order placed</h2>
      <p className="mt-1 text-sm text-slate-500">Your order ID is <span className="font-semibold text-slate-900 dark:text-white">#{placed.no}</span>. It is now pending.</p>
      <div className="mt-5 flex justify-center gap-2">
        <Link to={`/orders/${placed.id}`}><Button>View order</Button></Link>
        <Button variant="outline" onClick={() => { setPlaced(null); setUrl(''); setQty(''); setTouched(false) }}>Place another</Button>
      </div>
    </Card>
  )

  return (
    <>
      <PageHeader title="New order" sub="Credits are deducted when you confirm." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          {loading ? <Skeleton className="h-64" /> : <>
            <ErrorBox message={err} />
            <Field label="Platform">
              <Select value={platform} onChange={e => { setPlatform(e.target.value); setServiceId('') }}>
                <option value="">All platforms</option>{platforms.map(p => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Service" error={errors.service}>
              <Select value={serviceId} onChange={e => setServiceId(e.target.value)}>
                <option value="">Select a service…</option>
                {options.map(s => <option key={s.id} value={s.id}>{s.name} — {money(s.customer_rate)}/1k</option>)}
              </Select>
            </Field>
            {svc && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                {svc.description && <p>{svc.description}</p>}
                <p className="mt-1 text-slate-500">Min {fmtNum(svc.min_qty)} · Max {fmtNum(svc.max_qty)}{svc.est_time ? ` · ${svc.est_time}` : ''}</p>
                {svc.refill_policy && <p className="text-slate-500">Refill: {svc.refill_policy}</p>}
              </div>
            )}
            <Field label="Link (video, post or profile URL)" error={errors.url}>
              <Input type="url" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
            </Field>
            <Field label="Quantity" error={errors.qty}>
              <Input type="number" inputMode="numeric" min={svc?.min_qty} max={svc?.max_qty} step={1} value={qty} onChange={e => setQty(e.target.value)} />
            </Field>
          </>}
        </Card>

        <Card className="h-fit space-y-3">
          <h2 className="font-semibold">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Service</dt><dd className="text-right">{svc?.name ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Quantity</dt><dd>{q > 0 ? fmtNum(q) : '—'}</dd></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(total)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Your balance</dt><dd>{money(balance)}</dd></div>
          </dl>
          {insufficient && total > 0 && (
            <p className="text-sm text-red-600">Insufficient balance. <Link to="/add-funds" className="underline">Add funds</Link></p>
          )}
          <Button className="w-full" onClick={review} disabled={insufficient && total > 0}>Review order</Button>
        </Card>
      </div>

      <Modal open={confirm} onClose={() => !busy && setConfirm(false)} title="Confirm your order">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Service</dt><dd className="text-right">{svc?.name}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">Link</dt><dd className="break-all text-right">{url}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Quantity</dt><dd>{fmtNum(q)}</dd></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><dt>You will pay</dt><dd>{money(total)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Balance after</dt><dd>{money(balance - total)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">Orders cannot be edited after confirmation. Make sure the link is public.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>Back</Button>
          <Button onClick={place} disabled={busy}>{busy ? 'Placing…' : 'Confirm & pay'}</Button>
        </div>
      </Modal>
    </>
  )
}
