import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useSite } from '@/context/SiteContext'
import { errMsg } from '@/lib/utils'
import { Button, Card, ErrorBox, Field, Input, PageHeader, SuccessBox } from '@/components/ui'

export default function AdminSettings() {
  const { site, reload } = useSite()
  const [f, setF] = useState({ brand_name: '', logo_url: '', currency_code: '', currency_symbol: '', credits_per_currency_unit: '1', primary_color: '#4f46e5' })
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setF({ brand_name: site.brand_name, logo_url: site.logo_url ?? '', currency_code: site.currency_code, currency_symbol: site.currency_symbol,
      credits_per_currency_unit: String(site.credits_per_currency_unit), primary_color: site.primary_color })
  }, [site])

  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null); setOk(null)
    const rate = Number(f.credits_per_currency_unit)
    if (!(rate > 0)) return setErr('Credits per currency unit must be greater than zero.')
    if (f.logo_url && !/^https:\/\//i.test(f.logo_url)) return setErr('Logo URL must start with https://')
    if (!/^#[0-9a-f]{6}$/i.test(f.primary_color)) return setErr('Theme colour must be a hex value like #4f46e5.')
    setBusy(true)
    const { error } = await supabase.from('site_settings').update({
      brand_name: f.brand_name.trim() || 'SocialBoost', logo_url: f.logo_url.trim() || null,
      currency_code: f.currency_code.trim().toUpperCase(), currency_symbol: f.currency_symbol.trim(),
      credits_per_currency_unit: rate, primary_color: f.primary_color,
    }).eq('id', 1)
    setBusy(false)
    if (error) return setErr(errMsg(error))
    setOk('Settings saved.'); reload()
  }

  return (
    <>
      <PageHeader title="Site settings" sub="Brand, currency and theme." />
      <Card className="max-w-xl">
        <form onSubmit={save} className="space-y-4">
          <ErrorBox message={err} /><SuccessBox message={ok} />
          <Field label="Brand name"><Input value={f.brand_name} onChange={e => set('brand_name', e.target.value)} required /></Field>
          <Field label="Logo URL (https, optional)"><Input value={f.logo_url} onChange={e => set('logo_url', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency code"><Input value={f.currency_code} onChange={e => set('currency_code', e.target.value)} maxLength={5} required /></Field>
            <Field label="Currency symbol / label"><Input value={f.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} maxLength={6} required /></Field>
          </div>
          <Field label="Credits per 1 currency unit" hint="1 means 1 credit = 1 unit of currency. Service prices and wallet balances are stored in credits.">
            <Input type="number" min={0} step="any" value={f.credits_per_currency_unit} onChange={e => set('credits_per_currency_unit', e.target.value)} required />
          </Field>
          <Field label="Theme colour"><input type="color" value={f.primary_color} onChange={e => set('primary_color', e.target.value)} className="h-10 w-20 cursor-pointer rounded border" /></Field>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
        </form>
      </Card>
    </>
  )
}
