import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { fmtDate, fmtNum } from '@/lib/utils'
import { ORDER_STATUSES, type Order } from '@/lib/types'
import { Badge, Card, Empty, Input, PageHeader, Pager, Select, Table, TableSkeleton, Td, Th, useDebounced } from '@/components/ui'

const PAGE = 15

export default function Orders() {
  const { money } = useSite()
  const [rows, setRows] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const dq = useDebounced(search)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [status, dq])

  useEffect(() => {
    setLoading(true)
    let q = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1)
    if (status) q = q.eq('status', status)
    const term = dq.trim().replace(/[%,()]/g, '')
    if (term) {
      q = /^\d+$/.test(term) ? q.or(`order_no.eq.${term},service_name.ilike.%${term}%,target_url.ilike.%${term}%`)
        : q.or(`service_name.ilike.%${term}%,target_url.ilike.%${term}%`)
    }
    q.then(({ data, count }) => { setRows((data ?? []) as Order[]); setTotal(count ?? 0); setLoading(false) })
  }, [page, status, dq])

  return (
    <>
      <PageHeader title="My orders" />
      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Input placeholder="Search by order #, service or link…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search orders" />
          <Select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>{ORDER_STATUSES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No orders found" /> : (
          <>
            <Table>
              <thead><tr><Th>Order</Th><Th>Service</Th><Th>Link</Th><Th>Qty</Th><Th>Price</Th><Th>Date</Th><Th>Status</Th></tr></thead>
              <tbody>{rows.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <Td><Link to={`/orders/${o.id}`} className="font-medium text-brand-600 hover:underline">#{o.order_no}</Link></Td>
                  <Td>{o.service_name}</Td>
                  <Td className="max-w-[200px] truncate"><span title={o.target_url}>{o.target_url}</span></Td>
                  <Td>{fmtNum(o.quantity)}</Td><Td>{money(o.customer_price)}</Td><Td>{fmtDate(o.created_at)}</Td>
                  <Td><Badge status={o.status} /></Td>
                </tr>))}</tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
