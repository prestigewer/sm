import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui'

const Splash = () => (
  <div className="mx-auto max-w-md space-y-3 p-10"><Skeleton className="h-8 w-40" /><Skeleton className="h-32 w-full" /></div>
)

/** UX guard only. Real enforcement is RLS + SECURITY DEFINER functions in the database. */
export function RequireAuth() {
  const { session, profile, loading, signOut } = useAuth()
  const loc = useLocation()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (profile?.status === 'suspended') {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Account suspended</h1>
        <p className="mt-2 text-sm text-slate-500">Your account has been suspended. Please contact support.</p>
        <button className="mt-4 text-sm text-brand-600 underline" onClick={signOut}>Log out</button>
      </div>
    )
  }
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin, loading } = useAuth()
  if (loading) return <Splash />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (session) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
