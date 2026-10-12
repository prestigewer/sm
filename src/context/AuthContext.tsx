import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  balance: number
  loading: boolean
  isAdmin: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState>(null as unknown as AuthState)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setBalance(0); return }
    const [{ data: p }, { data: w }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).single(),
      supabase.from('wallets').select('balance').eq('user_id', s.user.id).single(),
    ])
    setProfile((p as Profile) ?? null)
    setBalance(Number(w?.balance ?? 0))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await load(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // defer to avoid deadlocks inside the auth callback
      setTimeout(() => { load(s) }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  // Role comes from the database profile row, never from client-editable metadata.
  const value: AuthState = {
    session, profile, balance, loading,
    isAdmin: profile?.role === 'admin' && profile?.status === 'active',
    refresh: () => load(session),
    signOut: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
