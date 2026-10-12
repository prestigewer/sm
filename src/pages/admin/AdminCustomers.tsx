import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { fmtDate } from '@/lib/utils'
import { Badge, Card, Empty, Input, PageHeader, Pager, Table, TableSkeleton, Td, Th, useDebounced } from '@/components/ui'

const PAGE = 20

export default function AdminCustomers() {
  const { money } = useSite()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const dq = useDebounced(search)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [dq])
  useEffect(() => {
    setLoading(true)
    let q = supabase.from('profiles').select('*, wallets(balance)', { count: 'exact' }).eq('role', 'customer')
      .order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    const term = dq.trim().replace(/[%,()]/g, '')
    if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`)
    q.then(({ data, count }) => { setRows(data ?? []); setTotal(count ?? 0); setLoading(false) })
  }, [page, dq])

  return (
    <>
      <PageHeader title="Customers" />
      <Card>
        <div className="mb-4 max-w-sm"><Input placeholder="Search name, email or phone…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search" /></div>
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No customers found" /> : (
          <>
            <Table>
              <thead><tr><Th>Name</Th><Th>Email</Th><Th>Balance</Th><Th>Status</Th><Th>Joined</Th></tr></thead>
              <tbody>{rows.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <Td><Link className="font-medium text-brand-600 hover:underline" to={`/admin/customers/${c.id}`}>{c.full_name || '(no name)'}</Link></Td>
                  <Td>{c.email}</Td><Td>{money(c.wallets?.balance ?? 0)}</Td><Td><Badge status={c.status} /></Td><Td>{fmtDate(c.created_at)}</Td>
                </tr>))}</tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
