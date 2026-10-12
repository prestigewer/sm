import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { errMsg, fmtDate, fmtNum } from '@/lib/utils'
import type { Order } from '@/lib/types'
import { Badge, Button, Card, ErrorBox, PageHeader, Skeleton, SuccessBox } from '@/components/ui'

type Hist = { id: string; old_status: string | null; new_status: string; created_at: string }

export default function OrderDetail() {
  const { id } = useParams()
  const { money } = useSite()
  const [o, setO] = useState<Order | null>(null)
  const [hist, setHist] = useState<Hist[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).maybeSingle(),
      supabase.from('order_status_history').select('id,old_status,new_status,created_at').eq('order_id', id).order('created_at'),
    ])
    setO((a.data as Order) ?? null); setHist((b.data ?? []) as Hist[]); setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  const cancel = async () => {
    setErr(null); setMsg(null)
    const { error } = await supabase.rpc('request_order_cancel', { p_order: id })
    if (error) return setErr(errMsg(error))
    setMsg('Cancellation requested. An admin will review it; a refund is not automatic.')
    load()
  }

  if (loading) return <Skeleton className="h-64" />
  if (!o) return <Card>Order not found.</Card>

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0"><dt className="text-slate-500">{k}</dt><dd className="break-all text-right">{v}</dd></div>
  )

  return (
    <>
      <Link to="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Orders</Link>
      <PageHeader title={`Order #${o.order_no}`} actions={<Badge status={o.status} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <dl>
            {row('Service', o.service_name)}
            {row('Link', <a href={o.target_url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{o.target_url}</a>)}
            {row('Quantity', fmtNum(o.quantity))}
            {row('Price', money(o.customer_price))}
            {Number(o.refunded_amount) > 0 && row('Refunded', money(o.refunded_amount))}
            {row('Placed', fmtDate(o.created_at))}
            {row('Last update', fmtDate(o.updated_at))}
          </dl>
          <div className="mt-4 space-y-2">
            <ErrorBox message={err} /><SuccessBox message={msg} />
            {['pending', 'processing'].includes(o.status) && (
              <Button variant="outline" onClick={cancel} disabled={o.cancel_requested}>
                {o.cancel_requested ? 'Cancellation requested' : 'Request cancellation'}
              </Button>
            )}
            <Link to="/support" className="block text-sm text-brand-600 hover:underline">Need help with this order?</Link>
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Status history</h2>
          <ol className="space-y-3 border-l pl-4">
            {hist.map(h => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-600" />
                <Badge status={h.new_status} /><span className="ml-2 text-xs text-slate-500">{fmtDate(h.created_at)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  )
}
