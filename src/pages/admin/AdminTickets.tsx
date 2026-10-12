import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn, fmtDate } from '@/lib/utils'
import { Badge, Card, Empty, PageHeader, Pager, Table, TableSkeleton, Td, Th } from '@/components/ui'

const PAGE = 20

export default function AdminTickets() {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => {
    setLoading(true)
    let q = supabase.from('support_tickets').select('*, profiles(full_name,email)', { count: 'exact' })
      .order('updated_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (status) q = q.eq('status', status)
    q.then(({ data, count }) => { setRows(data ?? []); setTotal(count ?? 0); setLoading(false) })
  }, [page, status])

  return (
    <>
      <PageHeader title="Support tickets" />
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {['', 'open', 'customer_reply', 'answered', 'closed'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize', status === s ? 'border-brand-600 bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>{(s || 'All').replace('_', ' ')}</button>
          ))}
        </div>
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No tickets" /> : (
          <>
            <Table><thead><tr><Th>Subject</Th><Th>Customer</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
              <tbody>{rows.map(t => (
                <tr key={t.id}><Td><Link className="font-medium text-brand-600 hover:underline" to={`/admin/tickets/${t.id}`}>{t.subject}</Link></Td>
                  <Td>{t.profiles?.full_name || t.profiles?.email}</Td><Td><Badge status={t.status} /></Td><Td>{fmtDate(t.updated_at)}</Td></tr>))}</tbody></Table>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
