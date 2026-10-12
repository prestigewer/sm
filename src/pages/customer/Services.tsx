import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { fmtNum } from '@/lib/utils'
import type { PublicService } from '@/lib/types'
import { Button, Card, Empty, Input, PageHeader, Select, Skeleton } from '@/components/ui'

export default function Services() {
  const { money } = useSite()
  const [rows, setRows] = useState<PublicService[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [platform, setPlatform] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    supabase.from('services_public').select('*').order('platform').order('name').then(({ data }) => {
      setRows((data ?? []) as PublicService[]); setLoading(false)
    })
  }, [])

  const platforms = useMemo(() => [...new Set(rows.map(r => r.platform))], [rows])
  const categories = useMemo(() => [...new Set(rows.filter(r => !platform || r.platform === platform).map(r => r.category_name))], [rows, platform])
  const filtered = rows.filter(r =>
    (!platform || r.platform === platform) && (!category || r.category_name === category) &&
    (!q || (r.name + r.description).toLowerCase().includes(q.toLowerCase())))

  return (
    <>
      <PageHeader title="Services" sub="Browse everything we offer. Prices are per 1,000." />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Search services…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
          <Select value={platform} onChange={e => { setPlatform(e.target.value); setCategory('') }} aria-label="Platform">
            <option value="">All platforms</option>{platforms.map(p => <option key={p}>{p}</option>)}
          </Select>
          <Select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
            <option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
      </Card>
      {loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
        : filtered.length === 0 ? <Card><Empty title="No services match" hint="Try changing your filters." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map(s => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{s.platform} · {s.category_name}</p>
                  <h3 className="mt-0.5 font-semibold">{s.name}</h3>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Available</span>
              </div>
              {s.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.description}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">Price / 1,000</dt><dd className="font-medium">{money(s.customer_rate)}</dd>
                <dt className="text-slate-500">Min / Max</dt><dd>{fmtNum(s.min_qty)} / {fmtNum(s.max_qty)}</dd>
                {s.est_time && <><dt className="text-slate-500">Est. time</dt><dd>{s.est_time}</dd></>}
                {s.refill_policy && <><dt className="text-slate-500">Refill</dt><dd>{s.refill_policy}</dd></>}
                {s.cancel_policy && <><dt className="text-slate-500">Cancellation</dt><dd>{s.cancel_policy}</dd></>}
              </dl>
              <Link to={`/new-order?service=${s.id}`}><Button className="mt-4 w-full" size="sm">Order this service</Button></Link>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
