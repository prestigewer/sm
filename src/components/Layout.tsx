import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, ListOrdered, Wallet, Receipt, LifeBuoy, User, Users, Package, CreditCard,
  Settings, BarChart3, Bell, Menu, Moon, Sun, LogOut, Zap, X, Banknote,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useSite } from '@/context/SiteContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Item = { to: string; label: string; icon: ReactNode; end?: boolean }
const ic = 'h-4 w-4'

const customerNav: Item[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className={ic} />, end: true },
  { to: '/services', label: 'Services', icon: <Package className={ic} /> },
  { to: '/new-order', label: 'New Order', icon: <ShoppingCart className={ic} /> },
  { to: '/orders', label: 'My Orders', icon: <ListOrdered className={ic} /> },
  { to: '/add-funds', label: 'Add Funds', icon: <Wallet className={ic} /> },
  { to: '/transactions', label: 'Transactions', icon: <Receipt className={ic} /> },
  { to: '/support', label: 'Support', icon: <LifeBuoy className={ic} /> },
  { to: '/profile', label: 'Profile', icon: <User className={ic} /> },
]
const adminNav: Item[] = [
  { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ic} />, end: true },
  { to: '/admin/orders', label: 'Orders', icon: <ListOrdered className={ic} /> },
  { to: '/admin/recharges', label: 'Recharges', icon: <Banknote className={ic} /> },
  { to: '/admin/customers', label: 'Customers', icon: <Users className={ic} /> },
  { to: '/admin/services', label: 'Services', icon: <Package className={ic} /> },
  { to: '/admin/tickets', label: 'Support', icon: <LifeBuoy className={ic} /> },
  { to: '/admin/reports', label: 'Reports', icon: <BarChart3 className={ic} /> },
  { to: '/admin/payments', label: 'Payment Settings', icon: <CreditCard className={ic} /> },
  { to: '/admin/settings', label: 'Site Settings', icon: <Settings className={ic} /> },
]

export function Layout({ admin = false }: { admin?: boolean }) {
  const { profile, balance, signOut, isAdmin } = useAuth()
  const { site, dark, toggleDark, money } = useSite()
  const [open, setOpen] = useState(false)
  const nav = admin ? adminNav : customerNav
  const navigate = useNavigate()

  const SidebarBody = (
    <>
      <div className="flex h-16 items-center gap-2 px-5 text-lg font-bold">
        {site.logo_url
          ? <img src={site.logo_url} alt="" className="h-7 w-7 rounded object-contain" />
          : <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Zap className="h-4 w-4" /></span>}
        <span>{site.brand_name}</span>
        {admin && <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">Admin</span>}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map(i => (
          <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setOpen(false)}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
            {i.icon}{i.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t p-3">
        {isAdmin && (
          <NavLink to={admin ? '/dashboard' : '/admin'} className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            {admin ? 'Switch to customer view' : 'Open admin panel'}
          </NavLink>
        )}
        <button onClick={async () => { await signOut(); navigate('/login') }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <LogOut className={ic} /> Log out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-white dark:bg-slate-900 lg:flex">{SidebarBody}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white dark:bg-slate-900 animate-fadeIn">
            <button className="absolute right-2 top-3 rounded p-1" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            {SidebarBody}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 px-4 backdrop-blur dark:bg-slate-900/80 sm:px-6">
          <button className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            {!admin && (
              <button onClick={() => navigate('/add-funds')} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 dark:bg-slate-800 dark:text-white">
                {money(balance)}
              </button>
            )}
            {admin && <BellButton />}
            <button onClick={toggleDark} aria-label="Toggle dark mode" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">{profile?.full_name || profile?.email}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  )
}

type Notif = { id: string; kind: string; title: string; body: string; link: string | null; is_read: boolean; created_at: string }

function BellButton() {
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const unread = items.filter(i => !i.is_read).length

  const load = async () => {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
    setItems((data as Notif[]) ?? [])
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('admin-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, load)
      .subscribe()
    const t = setInterval(load, 30000) // fallback if realtime isn't enabled for the table
    return () => { supabase.removeChannel(ch); clearInterval(t) }
  }, [])

  const markAll = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    load()
  }
  const openItem = async (n: Notif) => {
    if (!n.is_read) await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    setOpen(false)
    load()
    if (n.link) navigate(n.link)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications" className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border bg-white shadow-xl dark:bg-slate-900 animate-fadeIn">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            <button className="text-xs text-brand-600 hover:underline" onClick={markAll}>Mark all read</button>
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nothing yet</p>}
            {items.map(n => (
              <button key={n.id} onClick={() => openItem(n)} className={cn('block w-full border-b px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800', !n.is_read && 'bg-brand-50/60 dark:bg-slate-800/60')}>
                <span className="font-medium">{n.title}</span>
                <span className="block truncate text-xs text-slate-500">{n.body}</span>
                <span className="text-[11px] text-slate-400">{new Date(n.created_at).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
