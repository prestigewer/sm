import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { fmtDate } from '@/lib/utils'
import { Badge, Card, Empty, PageHeader, Skeleton, Stat, Table, Td, Th } from '@/components/ui'

type Stats = Record<string, number>
type SalesRow = { period: string; orders: number; sales: number; supplier_cost: number; gross_profit: number }
type SvcRow = { service_name: string; orders: number; sales: number }

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function AdminDashboard() {
  const { money } = useSite()
  const [stats, setStats] = useState<Stats | null>(null)
  const [sales, setSales] = useState<SalesRow[]>([])
  const [svc, setSvc] = useState<SvcRow[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [recharges, setRecharges] = useState<any[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 29)
    ;(async () => {
      const [s, r, sv, c, o, rc] = await Promise.all([
        supabase.rpc('admin_dashboard_stats'),
        supabase.rpc('admin_sales_report', { p_from: iso(from), p_to: iso(to), p_bucket: 'day' }),
        supabase.rpc('admin_service_performance', { p_from: iso(from), p_to: iso(to) }),
        supabase.from('profiles').select('id,full_name,email,created_at').eq('role', 'customer').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('id,order_no,service_name,customer_price,status,created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('recharge_requests').select('id,amount,status,created_at,transaction_ref').order('created_at', { ascending: false }).limit(5),
      ])
      if (s.error) setErr(s.error.message)
      setStats(s.data as Stats)
      setSales(((r.data ?? []) as SalesRow[]).map(x => ({ ...x, sales: Number(x.sales), supplier_cost: Number(x.supplier_cost), gross_profit: Number(x.gross_profit), period: x.period.slice(5) })))
      setSvc(((sv.data ?? []) as SvcRow[]).slice(0, 8).map(x => ({ ...x, sales: Number(x.sales) })))
      setCustomers(c.data ?? []); setOrders(o.data ?? []); setRecharges(rc.data ?? [])
    })()
  }, [])

  return (
    <>
      <PageHeader title="Admin dashboard" sub="Live figures from the database. Profit shown is gross profit (before operating expenses)." />
      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
      {!stats ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Customers" value={stats.customers} />
          <Stat label="Total orders" value={stats.orders} />
          <Stat label="Pending orders" value={stats.pending_orders} />
          <Stat label="Completed orders" value={stats.completed_orders} />
          <Stat label="Pending recharges" value={stats.pending_recharges} />
          <Stat label="Approved recharges" value={money(stats.approved_recharge_total)} />
          <Stat label="Total sales" value={money(stats.sales)} sub="Net of refunds" />
          <Stat label="Supplier cost" value={money(stats.supplier_cost)} />
          <Stat label="Gross profit" value={money(stats.gross_profit)} sub="Sales − supplier cost. Not net profit." />
          <Stat label="Refunds issued" value={money(stats.refunds)} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Daily sales & gross profit (30 days)</h2>
          <div className="h-64">
            {sales.length === 0 ? <Empty title="No data yet" /> : (
              <ResponsiveContainer><LineChart data={sales}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
                <Line type="monotone" dataKey="sales" stroke="#4f46e5" name="Sales" dot={false} />
                <Line type="monotone" dataKey="gross_profit" stroke="#059669" name="Gross profit" dot={false} /></LineChart></ResponsiveContainer>)}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Order volume (30 days)</h2>
          <div className="h-64">
            {sales.length === 0 ? <Empty title="No data yet" /> : (
              <ResponsiveContainer><BarChart data={sales}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
                <Bar dataKey="orders" fill="#7c3aed" name="Orders" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>)}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Service performance (30 days, by sales)</h2>
          <div className="h-64">
            {svc.length === 0 ? <Empty title="No data yet" /> : (
              <ResponsiveContainer><BarChart data={svc} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="service_name" width={160} fontSize={12} /><Tooltip />
                <Bar dataKey="sales" fill="#4f46e5" name="Sales" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>)}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card><h2 className="mb-3 font-semibold">Recent registrations</h2>
          <Table><thead><tr><Th>Name</Th><Th>Joined</Th></tr></thead><tbody>
            {customers.map(c => <tr key={c.id}><Td><Link className="text-brand-600 hover:underline" to={`/admin/customers/${c.id}`}>{c.full_name || c.email}</Link></Td><Td>{fmtDate(c.created_at)}</Td></tr>)}</tbody></Table></Card>
        <Card><h2 className="mb-3 font-semibold">Recent orders</h2>
          <Table><thead><tr><Th>#</Th><Th>Price</Th><Th>Status</Th></tr></thead><tbody>
            {orders.map(o => <tr key={o.id}><Td><Link className="text-brand-600 hover:underline" to={`/admin/orders/${o.id}`}>{o.order_no}</Link></Td><Td>{money(o.customer_price)}</Td><Td><Badge status={o.status} /></Td></tr>)}</tbody></Table></Card>
        <Card><h2 className="mb-3 font-semibold">Recent payment requests</h2>
          <Table><thead><tr><Th>Amount</Th><Th>Status</Th></tr></thead><tbody>
            {recharges.map(r => <tr key={r.id}><Td><Link className="text-brand-600 hover:underline" to="/admin/recharges">{money(r.amount)}</Link></Td><Td><Badge status={r.status} /></Td></tr>)}</tbody></Table></Card>
      </div>
    </>
  )
}
