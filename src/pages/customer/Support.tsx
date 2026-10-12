import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { errMsg, fmtDate } from '@/lib/utils'
import type { Order } from '@/lib/types'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Table, TableSkeleton, Td, Textarea, Th } from '@/components/ui'

type Ticket = { id: string; subject: string; status: string; order_id: string | null; created_at: string; updated_at: string }

export default function Support() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [orders, setOrders] = useState<Pick<Order, 'id' | 'order_no' | 'service_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [orderId, setOrderId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [t, o] = await Promise.all([
      supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }),
      supabase.from('orders').select('id,order_no,service_name').order('created_at', { ascending: false }).limit(100),
    ])
    setTickets((t.data ?? []) as Ticket[]); setOrders((o.data ?? []) as any); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!session) return
    setErr(null); setBusy(true)
    const { data: t, error } = await supabase.from('support_tickets')
      .insert({ user_id: session.user.id, subject: subject.trim(), order_id: orderId || null }).select('id').single()
    if (error || !t) { setBusy(false); return setErr(errMsg(error)) }
    const { error: e2 } = await supabase.from('support_messages')
      .insert({ ticket_id: t.id, sender_id: session.user.id, is_admin: false, message: message.trim() })
    setBusy(false)
    if (e2) return setErr(errMsg(e2))
    setOpen(false); setSubject(''); setMessage(''); setOrderId('')
    navigate(`/support/${t.id}`)
  }

  return (
    <>
      <PageHeader title="Support" sub="Questions about an order or your wallet? Open a ticket."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New ticket</Button>} />
      <Card>
        {loading ? <TableSkeleton /> : tickets.length === 0 ? <Empty title="No tickets" hint="You haven't contacted support yet." /> : (
          <Table><thead><tr><Th>Subject</Th><Th>Status</Th><Th>Opened</Th><Th>Updated</Th></tr></thead>
            <tbody>{tickets.map(t => (
              <tr key={t.id}><Td><Link className="font-medium text-brand-600 hover:underline" to={`/support/${t.id}`}>{t.subject}</Link></Td>
                <Td><Badge status={t.status} /></Td><Td>{fmtDate(t.created_at)}</Td><Td>{fmtDate(t.updated_at)}</Td></tr>))}</tbody></Table>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket">
        <form onSubmit={create} className="space-y-4">
          <ErrorBox message={err} />
          <Field label="Subject"><Input required minLength={3} maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} /></Field>
          <Field label="Related order (optional)">
            <Select value={orderId} onChange={e => setOrderId(e.target.value)}>
              <option value="">None</option>{orders.map(o => <option key={o.id} value={o.id}>#{o.order_no} — {o.service_name}</option>)}
            </Select>
          </Field>
          <Field label="Message"><Textarea required maxLength={5000} value={message} onChange={e => setMessage(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Create ticket'}</Button></div>
        </form>
      </Modal>
    </>
  )
}
