import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { cn, errMsg, fmtDate } from '@/lib/utils'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Table, TableSkeleton, Td, Textarea, Th } from '@/components/ui'

const PAGE = 15

export default function AdminRecharges() {
  const { money } = useSite()
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<any | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [prev, setPrev] = useState<any[]>([])
  const [internal, setInternal] = useState('')
  const [publicNote, setPublicNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('recharge_requests').select('*, profiles(id,full_name,email), recharge_private(internal_note)', { count: 'exact' })
      .order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)
    if (status) q = q.eq('status', status)
    const { data, count } = await q
    setRows(data ?? []); setTotal(count ?? 0); setLoading(false)
  }, [page, status])
  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { load() }, [load])

  const open = async (r: any) => {
    setSel(r); setErr(null); setProofUrl(null); setPublicNote('')
    setInternal(r.recharge_private?.internal_note ?? '')
    if (r.proof_path) {
      const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(r.proof_path, 300)
      setProofUrl(data?.signedUrl ?? null)
    }
    const { data: p } = await supabase.from('recharge_requests').select('id,amount,status,created_at,transaction_ref')
      .eq('user_id', r.user_id).neq('id', r.id).order('created_at', { ascending: false }).limit(10)
    setPrev(p ?? [])
  }

  const act = async (kind: 'approve' | 'reject' | 'note') => {
    if (!sel) return
    setBusy(true); setErr(null)
    const res = kind === 'approve'
      ? await supabase.rpc('admin_approve_recharge', { p_id: sel.id, p_internal_note: internal.trim() || null })
      : kind === 'reject'
        ? await supabase.rpc('admin_reject_recharge', { p_id: sel.id, p_public_note: publicNote.trim() || null, p_internal_note: internal.trim() || null })
        : await supabase.rpc('admin_save_recharge_note', { p_id: sel.id, p_note: internal })
    setBusy(false)
    if (res.error) return setErr(errMsg(res.error))
    setSel(null); load()
  }

  const isProofImage = sel?.proof_path && /\.(png|jpe?g|webp)$/i.test(sel.proof_path)

  return (
    <>
      <PageHeader title="Recharge requests" sub="Verify the payment in your bank/wallet before approving. Approval credits the wallet exactly once." />
      <Card>
        <div className="mb-4 flex gap-2">
          {['pending', 'approved', 'rejected', ''].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize', status === s ? 'border-brand-600 bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}>{s || 'All'}</button>
          ))}
        </div>
        {loading ? <TableSkeleton /> : rows.length === 0 ? <Empty title="No requests" /> : (
          <>
            <Table>
              <thead><tr><Th>Customer</Th><Th>Amount</Th><Th>Reference</Th><Th>Submitted</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id}>
                  <Td><Link className="text-brand-600 hover:underline" to={`/admin/customers/${r.profiles?.id}`}>{r.profiles?.full_name || r.profiles?.email}</Link><div className="font-mono text-[11px] text-slate-400">{r.user_id.slice(0, 8)}</div></Td>
                  <Td>{money(r.amount)}</Td><Td className="font-mono text-xs">{r.transaction_ref}</Td><Td>{fmtDate(r.created_at)}</Td>
                  <Td><Badge status={r.status} /></Td><Td><Button size="sm" variant="outline" onClick={() => open(r)}>Review</Button></Td>
                </tr>))}</tbody>
            </Table>
            <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={!!sel} onClose={() => !busy && setSel(null)} title="Review recharge">
        {sel && (
          <div className="space-y-4">
            <ErrorBox message={err} />
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Customer</dt><dd>{sel.profiles?.full_name || sel.profiles?.email}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Amount</dt><dd className="font-semibold">{money(sel.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Reference</dt><dd className="font-mono">{sel.transaction_ref}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Submitted</dt><dd>{fmtDate(sel.created_at)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><Badge status={sel.status} /></dd></div>
            </dl>
            <div>
              <p className="mb-1 text-sm font-medium">Payment proof</p>
              {!sel.proof_path ? <p className="text-sm text-slate-500">No proof uploaded.</p> : !proofUrl ? <p className="text-sm text-slate-500">Loading…</p> :
                isProofImage ? <a href={proofUrl} target="_blank" rel="noopener noreferrer"><img src={proofUrl} alt="Payment proof" className="max-h-64 rounded-lg border" /></a>
                  : <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 underline">Open proof file</a>}
            </div>
            <Field label="Internal note (admins only)"><Textarea value={internal} onChange={e => setInternal(e.target.value)} /></Field>
            {sel.status === 'pending' && <Field label="Message to customer if rejecting (optional)"><Input value={publicNote} onChange={e => setPublicNote(e.target.value)} placeholder="e.g. Payment not received" /></Field>}
            {prev.length > 0 && (
              <div><p className="mb-1 text-sm font-medium">Previous requests by this customer</p>
                <ul className="space-y-1 text-xs">{prev.map(p => <li key={p.id} className="flex items-center justify-between"><span>{fmtDate(p.created_at)} · {money(p.amount)}</span><Badge status={p.status} /></li>)}</ul></div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => act('note')}>Save note</Button>
              {sel.status === 'pending' && <>
                <Button variant="danger" disabled={busy} onClick={() => act('reject')}>Reject</Button>
                <Button disabled={busy} onClick={() => act('approve')}>{busy ? 'Working…' : `Approve & credit ${money(sel.amount)}`}</Button>
              </>}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
