import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { cn, downloadCsv, errMsg, fmtDate, fmtNum } from '@/lib/utils'
import { Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Pager, Select, Table, TableSkeleton, Td, Th } from '@/components/ui'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const PAGE = 15
type Tab = 'sales' | 'services' | 'customers' | 'recharges' | 'refunds'
const TABS: { id: Tab; label: string }[] = [
  { id: 'sales', label: 'Sales & profit' }, { id: 'services', label: 'Services' }, { id: 'customers', label: 'Customer spending' },
  { id: 'recharges', label: 'Recharge approvals' }, { id: 'refunds', label: 'Refunds' },
]

export default function AdminReports() {
  const { money } = useSite()
  const today = new Date(); const start = new Date(); start.setDate(today.getDate() - 29)
  const [tab, setTab] = useState<Tab>('sales')
  const [from, setFrom] = useState(iso(start))
  const [to, setTo] = useState(iso(today))
  const [bucket, setBucket] = useState('day')
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    const end = new Date(to); end.setDate(end.getDate() + 1)
    const rangeStart = from, rangeEnd = iso(end)
    let data: Record<string, any>[] = []
    let error: any = null

    if (tab === 'sales') {
      const r = await supabase.rpc('admin_sales_report', { p_from: from, p_to: to, p_bucket: bucket }); error = r.error
      data = (r.data ?? []).map((x: any) => ({ Period: x.period, Orders: x.orders, Sales: Number(x.sales), 'Supplier cost': Number(x.supplier_cost), 'Gross profit': Number(x.gross_profit), Refunds: Number(x.refunds) }))
    } else if (tab === 'services') {
      const r = await supabase.rpc('admin_service_performance', { p_from: from, p_to: to }); error = r.error
      data = (r.data ?? []).map((x: any) => ({ Service: x.service_name, Orders: x.orders, Units: x.units, Sales: Number(x.sales), Completed: x.completed, 'Completion rate %': x.orders ? Math.round((x.completed / x.orders) * 1000) / 10 : 0 }))
    } else if (tab === 'customers') {
      const r = await supabase.from('orders').select('user_id,customer_price,refunded_amount,status,profiles(full_name,email)').gte('created_at', rangeStart).lt('created_at', rangeEnd).not('status', 'in', '(failed,cancelled)').limit(20000)
      error = r.error
      const m = new Map<string, any>()
      for (const o of (r.data ?? []) as any[]) {
        const cur = m.get(o.user_id) ?? { Customer: o.profiles?.full_name || o.profiles?.email, Email: o.profiles?.email, Orders: 0, Spent: 0 }
        cur.Orders += 1; cur.Spent += Number(o.customer_price) - Number(o.refunded_amount); m.set(o.user_id, cur)
      }
      data = [...m.values()].sort((a, b) => b.Spent - a.Spent)
    } else if (tab === 'recharges') {
      const r = await supabase.from('recharge_requests').select('amount,status,transaction_ref,created_at,reviewed_at,profiles!recharge_requests_user_id_fkey(email)').gte('created_at', rangeStart).lt('created_at', rangeEnd).order('created_at', { ascending: false }).limit(20000)
      error = r.error
      data = ((r.data ?? []) as any[]).map(x => ({ Submitted: x.created_at, Customer: x.profiles?.email, Amount: Number(x.amount), Reference: x.transaction_ref, Status: x.status, Reviewed: x.reviewed_at ?? '' }))
    } else {
      const r = await supabase.from('orders').select('order_no,service_name,customer_price,refunded_amount,updated_at,profiles(email)').gt('refunded_amount', 0).gte('updated_at', rangeStart).lt('updated_at', rangeEnd).order('updated_at', { ascending: false }).limit(20000)
      error = r.error
      data = ((r.data ?? []) as any[]).map(x => ({ Order: x.order_no, Customer: x.profiles?.email, Service: x.service_name, Charged: Number(x.customer_price), Refunded: Number(x.refunded_amount), Date: x.updated_at }))
    }
    if (error) setErr(errMsg(error))
    setRows(data); setPage(1); setLoading(false)
  }, [tab, from, to, bucket])
  useEffect(() => { load() }, [load])

  const cols = rows[0] ? Object.keys(rows[0]) : []
  const moneyCols = new Set(['Sales', 'Supplier cost', 'Gross profit', 'Refunds', 'Spent', 'Amount', 'Charged', 'Refunded'])
  const dateCols = new Set(['Submitted', 'Reviewed', 'Date'])
  const view = rows.slice((page - 1) * PAGE, page * PAGE)
  const fmtCell = (c: string, v: any) =>
    v === '' || v == null ? '—' : moneyCols.has(c) ? money(v) : dateCols.has(c) ? fmtDate(v) : typeof v === 'number' ? fmtNum(v) : String(v)

  const totals = tab === 'sales' ? {
    sales: rows.reduce((s, r) => s + r.Sales, 0), cost: rows.reduce((s, r) => s + r['Supplier cost'], 0), profit: rows.reduce((s, r) => s + r['Gross profit'], 0),
  } : null

  return (
    <>
      <PageHeader title="Reports" sub="Profit figures are gross profit (sales − supplier cost). Operating expenses are not deducted, so this is not net profit."
        actions={<Button variant="outline" disabled={!rows.length} onClick={() => downloadCsv(`${tab}-${from}-to-${to}.csv`, rows)}><Download className="h-4 w-4" />Export CSV</Button>} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn('rounded-full border px-3 py-1 text-xs font-medium', tab === t.id ? 'border-brand-600 bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>{t.label}</button>)}
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Field label="From"><Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></Field>
          {tab === 'sales' && <Field label="Group by"><Select value={bucket} onChange={e => setBucket(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></Select></Field>}
        </div>
        <ErrorBox message={err} />
        {totals && !loading && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">Sales<div className="text-lg font-bold">{money(totals.sales)}</div></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">Supplier cost<div className="text-lg font-bold">{money(totals.cost)}</div></div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">Gross profit (not net)<div className="text-lg font-bold">{money(totals.profit)}</div></div>
          </div>
        )}
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No data for this range" /> : (
          <>
            <Table><thead><tr>{cols.map(c => <Th key={c}>{c}</Th>)}</tr></thead>
              <tbody>{view.map((r, i) => <tr key={i}>{cols.map(c => <Td key={c}>{fmtCell(c, r[c])}</Td>)}</tr>)}</tbody></Table>
            <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  )
}
