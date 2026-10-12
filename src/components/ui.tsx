import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900 animate-fadeIn', className)}>{children}</div>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'danger' | 'ghost'; size?: 'sm' | 'md' }
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    outline: 'border bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800',
  }[variant]
  return <button {...p} className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm', v, className)} />
}

const field = 'w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/40 dark:bg-slate-900'
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(field, p.className)} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(field, p.className)} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(field, 'min-h-[88px]', p.className)} />

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-500">{hint}</span>}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  )
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800', approved: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-purple-100 text-purple-800', failed: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800', cancelled: 'bg-slate-200 text-slate-700',
  refunded: 'bg-sky-100 text-sky-800', active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-red-100 text-red-800', open: 'bg-amber-100 text-amber-800',
  answered: 'bg-emerald-100 text-emerald-800', customer_reply: 'bg-blue-100 text-blue-800', closed: 'bg-slate-200 text-slate-700',
}
export const Badge = ({ status }: { status: string }) => (
  <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', statusColors[status] ?? 'bg-slate-100 text-slate-700')}>
    {status.replace('_', ' ')}
  </span>
)

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800', className)} />
)
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
)

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-slate-500">
      <Inbox className="h-8 w-8" />
      <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </div>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{message}</div>
}
export function SuccessBox({ message }: { message: string | null }) {
  if (!message) return null
  return <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{message}</div>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900 animate-fadeIn" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  )
}

export const Table = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>
)
export const Th = ({ children }: { children?: ReactNode }) => (
  <th className="whitespace-nowrap border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</th>
)
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn('border-b px-3 py-2.5 align-middle', className)}>{children}</td>
)

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
      <span>{total} result{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <span>Page {page} / {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

/** Debounce hook for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
