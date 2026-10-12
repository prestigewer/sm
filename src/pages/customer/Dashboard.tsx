import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ShoppingCart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { fmtDate } from '@/lib/utils'
import type { Order, WalletTx } from '@/lib/types'
import { Badge, Button, Card, Empty, PageHeader, Skeleton, Stat, Table, Td, Th } from '@/components/ui'

export default function Dashboard() {
  const { profile, balance, session } = useAuth()
  const { money } = useSite()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, spent: 0 })
  const [orders, setOrders] = useState<Order[]>([])
  const [txs, setTxs] = useState<WalletTx[]>([])

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const uid = session.user.id
      const [all, recentO, recentT] = await Promise.all([
        supabase.from('orders').select('status,customer_price,refunded_amount').eq('user_id', uid).limit(10000),
        supabase.from('orders').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
        supabase.from('wallet_transactions').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
      ])
      const rows = (all.data ?? []) as Pick<Order, 'status' | 'customer_price' | 'refunded_amount'>[]
      setStats({
        total: rows.length,
        pending: rows.filter(r => r.status === 'pending' || r.status === 'processing').length,
        completed: rows.filter(r => r.status === 'completed').length,
        spent: rows.filter(r => !['failed', 'cancelled'].includes(r.status))
          .reduce((s, r) => s + Number(r.customer_price) - Number(r.refunded_amount), 0),
      })
      setOrders((recentO.data ?? []) as Order[])
      setTxs((recentT.data ?? []) as WalletTx[])
      setLoading(false)
    })()
  }, [session])

  return (
    <>
      <PageHeader title={`Hello, ${profile?.full_name?.split(' ')[0] || 'there'}`} sub="Here's your account at a glance."
        actions={<>
          <Link to="/add-funds"><Button variant="outline"><Plus className="h-4 w-4" />Add funds</Button></Link>
          <Link to="/new-order"><Button><ShoppingCart className="h-4 w-4" />New order</Button></Link>
        </>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Wallet balance" value={money(balance)} />
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : <>
          <Stat label="Total orders" value={stats.total} />
          <Stat label="Pending / processing" value={stats.pending} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Total spent" value={money(stats.spent)} sub="Net of refunds" />
        </>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent orders</h2><Link to="/orders" className="text-sm text-brand-600 hover:underline">View all</Link></div>
          {loading ? <Skeleton className="h-40" /> : orders.length === 0 ? <Empty title="No orders yet" hint="Place your first order to get started." /> : (
            <Table><thead><tr><Th>#</Th><Th>Service</Th><Th>Price</Th><Th>Status</Th></tr></thead>
              <tbody>{orders.map(o => (
                <tr key={o.id}><Td><Link className="text-brand-600 hover:underline" to={`/orders/${o.id}`}>{o.order_no}</Link></Td>
                  <Td>{o.service_name}</Td><Td>{money(o.customer_price)}</Td><Td><Badge status={o.status} /></Td></tr>))}</tbody></Table>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent transactions</h2><Link to="/transactions" className="text-sm text-brand-600 hover:underline">View all</Link></div>
          {loading ? <Skeleton className="h-40" /> : txs.length === 0 ? <Empty title="No transactions yet" /> : (
            <Table><thead><tr><Th>Date</Th><Th>Type</Th><Th>Amount</Th></tr></thead>
              <tbody>{txs.map(t => (
                <tr key={t.id}><Td>{fmtDate(t.created_at)}</Td><Td className="capitalize">{t.type.replace('_', ' ')}</Td>
                  <Td><span className={Number(t.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Number(t.amount) >= 0 ? '+' : ''}{money(t.amount)}</span></Td></tr>))}</tbody></Table>
          )}
        </Card>
      </div>
    </>
  )
}
