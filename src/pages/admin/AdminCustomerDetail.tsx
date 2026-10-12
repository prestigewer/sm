import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { errMsg, fmtDate } from '@/lib/utils'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Skeleton, Stat, SuccessBox, Table, Td, Th } from '@/components/ui'

export default function AdminCustomerDetail() {
  const { id } = useParams()
  const { session } = useAuth()
  const { money } = useSite()
  const [p, setP] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [recharges, setRecharges] = useState<any[]>([])
  const [txs, setTxs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adj, setAdj] = useState(false)
  const [dir, setDir] = useState<'credit' | 'debit'>('credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from('profiles').select('*, wallets(balance)').eq('id', id).maybeSingle(),
      supabase.from('orders').select('id,order_no,service_name,customer_price,status,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(25),
      supabase.from('recharge_requests').select('id,amount,status,created_at,transaction_ref').eq('user_id', id).order('created_at', { ascending: false }).limit(25),
      supabase.from('wallet_transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(25),
    ])
    setP(a.data); setOrders(b.data ?? []); setRecharges(c.data ?? []); setTxs(d.data ?? []); setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  const submitAdj = async () => {
    setErr(null); setOk(null)
    const n = Number(amount)
    if (!(n > 0)) return setErr('Enter an amount greater than zero.')
    if (reason.trim().length < 3) return setErr('A reason is required.')
    setBusy(true)
    const { error } = await supabase.rpc('admin_adjust_wallet', { p_user: id, p_amount: dir === 'credit' ? n : -n, p_reason: reason.trim() })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setAdj(false); setAmount(''); setReason(''); setOk('Wallet adjusted and logged in the ledger.'); load()
  }

  const toggleStatus = async () => {
    setErr(null); setOk(null)
    const next = p.status === 'active' ? 'suspended' : 'active'
    const { error } = await supabase.rpc('admin_set_user_status', { p_user: id, p_status: next })
    if (error) return setErr(errMsg(error))
    setOk(`Account ${next}.`); load()
  }

  if (loading) return <Skeleton className="h-72" />
  if (!p) return <Card>Customer not found.</Card>
  const self = session?.user.id === p.id

  return (
    <>
      <Link to="/admin/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Customers</Link>
      <PageHeader title={p.full_name || p.email} sub={`${p.email}${p.phone ? ' · ' + p.phone : ''} · joined ${fmtDate(p.created_at)}`}
        actions={<>
          <Badge status={p.status} />
          {!self && p.role === 'customer' && <Button size="sm" variant={p.status === 'active' ? 'danger' : 'primary'} onClick={toggleStatus}>{p.status === 'active' ? 'Suspend' : 'Activate'}</Button>}
        </>} />
      <div className="space-y-3"><ErrorBox message={err} /><SuccessBox message={ok} /></div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Stat label="Wallet balance" value={money(p.wallets?.balance ?? 0)} />
        <Stat label="Orders (latest 25)" value={orders.length} />
        <Card className="flex items-center justify-center"><Button onClick={() => setAdj(true)}>Adjust wallet</Button></Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="mb-3 font-semibold">Orders</h2>
          {orders.length === 0 ? <Empty title="No orders" /> : <Table><thead><tr><Th>#</Th><Th>Service</Th><Th>Price</Th><Th>Status</Th></tr></thead><tbody>
            {orders.map(o => <tr key={o.id}><Td><Link className="text-brand-600 hover:underline" to={`/admin/orders/${o.id}`}>{o.order_no}</Link></Td><Td>{o.service_name}</Td><Td>{money(o.customer_price)}</Td><Td><Badge status={o.status} /></Td></tr>)}</tbody></Table>}
        </Card>
        <Card><h2 className="mb-3 font-semibold">Recharge history</h2>
          {recharges.length === 0 ? <Empty title="No recharges" /> : <Table><thead><tr><Th>Date</Th><Th>Amount</Th><Th>Status</Th></tr></thead><tbody>
            {recharges.map(r => <tr key={r.id}><Td>{fmtDate(r.created_at)}</Td><Td>{money(r.amount)}</Td><Td><Badge status={r.status} /></Td></tr>)}</tbody></Table>}
        </Card>
        <Card className="lg:col-span-2"><h2 className="mb-3 font-semibold">Ledger (latest 25)</h2>
          {txs.length === 0 ? <Empty title="No transactions" /> : <Table><thead><tr><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Before</Th><Th>After</Th><Th>Description</Th></tr></thead><tbody>
            {txs.map(t => <tr key={t.id}><Td>{fmtDate(t.created_at)}</Td><Td className="capitalize">{t.type.replace('_', ' ')}</Td>
              <Td><span className={Number(t.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{money(t.amount)}</span></Td><Td>{money(t.balance_before)}</Td><Td>{money(t.balance_after)}</Td><Td>{t.description}</Td></tr>)}</tbody></Table>}
        </Card>
      </div>

      <Modal open={adj} onClose={() => !busy && setAdj(false)} title="Adjust wallet">
        <div className="space-y-4">
          <ErrorBox message={err} />
          <Field label="Action"><Select value={dir} onChange={e => setDir(e.target.value as 'credit' | 'debit')}><option value="credit">Add credits</option><option value="debit">Deduct credits</option></Select></Field>
          <Field label="Amount"><Input type="number" min={0} step="any" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Reason (required, saved in the ledger)"><Input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAdj(false)}>Cancel</Button><Button onClick={submitAdj} disabled={busy}>{busy ? 'Saving…' : 'Confirm'}</Button></div>
        </div>
      </Modal>
    </>
  )
}
