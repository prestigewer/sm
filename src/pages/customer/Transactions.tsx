import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { fmtDate } from '@/lib/utils'
import type { WalletTx } from '@/lib/types'
import { Card, Empty, PageHeader, Pager, Select, Table, TableSkeleton, Td, Th } from '@/components/ui'

const PAGE = 20
const TYPES = ['recharge', 'order_deduction', 'refund', 'admin_credit', 'admin_debit', 'adjustment']

export default function Transactions() {
  const { money } = useSite()
  const [rows, setRows] = useState<WalletTx[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(1) }, [type])
  useEffect(() => {
    setLoading(true)
    let q = supabase.from('wallet_transactions').select('*', { count: 'exact' }).order('created_at', { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1)
    if (type) q = q.eq('type', type)
    q.then(({ data, count }) => { setRows((data ?? []) as WalletTx[]); setTotal(count ?? 0); setLoading(false) })
  }, [page, type])

  return (
    <>
      <PageHeader title="Wallet transactions" sub="A permanent record of every balance change." />
      <Card>
        <div className="mb-4 max-w-xs">
          <Select value={type} onChange={e => setType(e.target.value)} aria-label="Type">
            <option value="">All types</option>{TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </Select>
        </div>
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No transactions" /> : (
          <>
            <Table>
              <thead><tr><Th>ID</Th><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Before</Th><Th>After</Th><Th>Reference</Th><Th>Description</Th></tr></thead>
              <tbody>{rows.map(t => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.id.slice(0, 8)}</Td><Td>{fmtDate(t.created_at)}</Td>
                  <Td className="capitalize">{t.type.replace('_', ' ')}</Td>
                  <Td><span className={Number(t.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Number(t.amount) >= 0 ? '+' : ''}{money(t.amount)}</span></Td>
                  <Td>{money(t.balance_before)}</Td><Td>{money(t.balance_after)}</Td>
                  <Td className="font-mono text-xs">{(t.order_id ?? t.recharge_id)?.slice(0, 8) ?? '—'}</Td>
                  <Td>{t.description}</Td>
                </tr>))}</tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
