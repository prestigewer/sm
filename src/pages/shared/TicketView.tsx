import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { cn, errMsg, fmtDate } from '@/lib/utils'
import { Badge, Button, Card, ErrorBox, PageHeader, Skeleton, Textarea } from '@/components/ui'

type Msg = { id: string; sender_id: string; is_admin: boolean; message: string; created_at: string }
type Ticket = { id: string; subject: string; status: string; order_id: string | null; user_id: string }

export default function TicketView({ admin = false }: { admin?: boolean }) {
  const { id } = useParams()
  const { session } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const end = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('id', id).maybeSingle(),
      supabase.from('support_messages').select('*').eq('ticket_id', id).order('created_at'),
    ])
    setTicket((t.data as Ticket) ?? null); setMsgs((m.data ?? []) as Msg[]); setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!session || !text.trim()) return
    setBusy(true); setErr(null)
    const { error } = await supabase.from('support_messages')
      .insert({ ticket_id: id, sender_id: session.user.id, is_admin: admin, message: text.trim() })
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setText(''); load()
  }

  const setStatus = async (status: string) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
    if (error) setErr(errMsg(error)); else load()
  }

  if (loading) return <Skeleton className="h-64" />
  if (!ticket) return <Card>Ticket not found.</Card>
  const back = admin ? '/admin/tickets' : '/support'

  return (
    <>
      <Link to={back} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Tickets</Link>
      <PageHeader title={ticket.subject} sub={ticket.order_id ? 'Linked to an order' : undefined}
        actions={<>
          <Badge status={ticket.status} />
          {ticket.status !== 'closed'
            ? <Button size="sm" variant="outline" onClick={() => setStatus('closed')}>Close ticket</Button>
            : admin && <Button size="sm" variant="outline" onClick={() => setStatus('open')}>Reopen</Button>}
        </>} />
      {admin && ticket.order_id && <Link to={`/admin/orders/${ticket.order_id}`} className="mb-3 block text-sm text-brand-600 hover:underline">Open related order</Link>}
      <Card className="space-y-3">
        {msgs.map(m => (
          <div key={m.id} className={cn('flex', m.is_admin === admin ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-2 text-sm', m.is_admin ? 'bg-brand-50 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800/60')}>
              <p className="mb-0.5 text-xs font-semibold text-slate-500">{m.is_admin ? 'Support' : 'Customer'} · {fmtDate(m.created_at)}</p>
              <p className="whitespace-pre-wrap break-words">{m.message}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </Card>
      {ticket.status !== 'closed' || admin ? (
        <form onSubmit={send} className="mt-4 space-y-2">
          <ErrorBox message={err} />
          <Textarea required maxLength={5000} placeholder="Write a reply…" value={text} onChange={e => setText(e.target.value)} />
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reply'}</Button>
        </form>
      ) : <p className="mt-4 text-sm text-slate-500">This ticket is closed.</p>}
    </>
  )
}
