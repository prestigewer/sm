import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { SiteSettings } from '@/lib/types'

const DEFAULTS: SiteSettings = {
  brand_name: 'SocialBoost', logo_url: null, currency_code: 'PKR', currency_symbol: 'PKR',
  credits_per_currency_unit: 1, primary_color: '#4f46e5',
}

interface SiteState {
  site: SiteSettings
  reload: () => Promise<void>
  dark: boolean
  toggleDark: () => void
  money: (n: number | string) => string
}
const Ctx = createContext<SiteState>(null as unknown as SiteState)
export const useSite = () => useContext(Ctx)

const hexToRgb = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [79, 70, 229]
}
const mix = (c: number[], w: number, t: number) => c.map(v => Math.round(v + (t - v) * w))

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteSettings>(DEFAULTS)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('sb-dark') === '1' } catch { return false }
  })

  const reload = async () => {
    const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle()
    if (data) setSite({ ...DEFAULTS, ...(data as SiteSettings), credits_per_currency_unit: Number((data as any).credits_per_currency_unit) })
  }
  useEffect(() => { reload() }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('sb-dark', dark ? '1' : '0') } catch { /* ignore */ }
  }, [dark])

  useEffect(() => {
    document.title = site.brand_name
    const c = hexToRgb(site.primary_color)
    const set = (k: string, v: number[]) => document.documentElement.style.setProperty(k, v.join(' '))
    set('--brand-50', mix(c, 0.92, 255)); set('--brand-100', mix(c, 0.84, 255))
    set('--brand-500', mix(c, 0.15, 255)); set('--brand-600', c); set('--brand-700', mix(c, 0.2, 0))
  }, [site])

  const money = (n: number | string) =>
    `${site.currency_symbol} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  return <Ctx.Provider value={{ site, reload, dark, toggleDark: () => setDark(d => !d), money }}>{children}</Ctx.Provider>
}
