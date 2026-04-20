import { useCallback, useEffect, useState } from 'react'
import api from '../services/api'

export type TenantStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAYMENT_OVERDUE'
  | 'SUSPENDED'
  | 'CANCELLED'

export interface TenantData {
  id: string
  name: string
  tradeName: string | null
  status: TenantStatus
  planCycle: string | null
  trialEndsAt: string | null
  planExpiresAt: string | null
  planStartedAt: string | null
  lastBillingState: string | null
  lastBillingStateAt: string | null
}

export interface UserData {
  id: string
  name: string
  email: string
  role: string
}

interface CacheEntry {
  tenant: TenantData | null
  user: UserData | null
  fetchedAt: number
}

const CACHE_TTL_MS = 60_000

let cache: CacheEntry | null = null
let inflight: Promise<CacheEntry> | null = null

async function fetchMe(): Promise<CacheEntry> {
  const res = await api.get('/auth/me')
  const data = res?.data?.data ?? {}
  return {
    tenant: (data.tenant as TenantData | null) ?? null,
    user: (data.user as UserData | null) ?? null,
    fetchedAt: Date.now(),
  }
}

function getOrFetch(): Promise<CacheEntry> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cache)
  }
  if (inflight) return inflight
  inflight = fetchMe()
    .then((entry) => {
      cache = entry
      return entry
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function invalidateCurrentTenantCache(): void {
  cache = null
}

interface UseCurrentTenantResult {
  tenant: TenantData | null
  user: UserData | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useCurrentTenant(): UseCurrentTenantResult {
  const [tenant, setTenant] = useState<TenantData | null>(cache?.tenant ?? null)
  const [user, setUser] = useState<UserData | null>(cache?.user ?? null)
  const [loading, setLoading] = useState<boolean>(!cache)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async (force = false) => {
    if (force) cache = null
    setLoading(true)
    setError(null)
    try {
      const entry = await getOrFetch()
      setTenant(entry.tenant)
      setUser(entry.user)
    } catch (err) {
      // 401 is handled by the axios interceptor (refresh + retry or
      // redirect to /login). Any other error surfaces here.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      setTenant(cache.tenant)
      setUser(cache.user)
      setLoading(false)
      return
    }
    void (async () => {
      if (cancelled) return
      await load(false)
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const refetch = useCallback(async () => {
    await load(true)
  }, [load])

  return { tenant, user, loading, error, refetch }
}
