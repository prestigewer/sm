import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { fmtDate, fmtNum } from '@/lib/utils'
import { ORDER_STATUSES } from '@/lib/types'
import { Badge, Card, Empty, Input, PageHeader, Pager, Table, TableSkeleton, Td, Th, useDebounced } from '@/components/ui'
import { cn } from '@/lib/utils'

const PAGE = 20

export default function AdminOrders() {
  const { money } = useSite()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const dq = useDebounced(search)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [status, dq])
  useEffect(() => {
    setLoading(true)
    let q = supabase.from('orders').select('*, profiles(full_name,email)', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (status) q = q.eq('status', status)
    const term = dq.trim().replace(/[%,()]/g, '')
    if (term) q = /^\d+$/.test(term) ? q.or(`order_no.eq.${term},service_name.ilike.%${term}%,target_url.ilike.%${term}%`)
      : q.or(`service_name.ilike.%${term}%,target_url.ilike.%${term}%`)
    q.then(({ data, count }) => { setRows(data ?? []); setTotal(count ?? 0); setLoading(false) })
  }, [page, status, dq])

  const tabs = ['', ...ORDER_STATUSES]
  return (
    <>
      <PageHeader title="Orders" sub="Fulfil pending orders with your supplier, then update the status here." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button key={t} onClick={() => setStatus(t)} className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize', status === t ? 'border-brand-600 bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>
              {t || 'All'}
            </button>
          ))}
        </div>
        <div className="mb-4 max-w-sm"><Input placeholder="Search order #, service or link…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" /></div>
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No orders" /> : (
          <>
            <Table>
              <thead><tr><Th>#</Th><Th>Customer</Th><Th>Service</Th><Th>Qty</Th><Th>Price</Th><Th>Date</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{rows.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <Td><Link className="font-medium text-brand-600 hover:underline" to={`/admin/orders/${o.id}`}>#{o.order_no}</Link></Td>
                  <Td>{o.profiles?.full_name || o.profiles?.email}</Td><Td>{o.service_name}</Td><Td>{fmtNum(o.quantity)}</Td>
                  <Td>{money(o.customer_price)}</Td><Td>{fmtDate(o.created_at)}</Td><Td><Badge status={o.status} /></Td>
                  <Td>{o.cancel_requested && o.status !== 'cancelled' && o.status !== 'refunded' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">Cancel requested</span>}</Td>
                </tr>))}</tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
