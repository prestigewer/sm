import type { ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { useSite } from '@/context/SiteContext'

export function AuthShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const { site } = useSite()
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-br from-brand-50 via-white to-purple-50 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-lg dark:bg-slate-900 animate-fadeIn">
        <div className="mb-6 flex items-center gap-2 text-lg font-bold">
          {site.logo_url
            ? <img src={site.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            : <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"><Zap className="h-4 w-4" /></span>}
          {site.brand_name}
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        {sub && <p className="mb-5 mt-1 text-sm text-slate-500">{sub}</p>}
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  )
}
