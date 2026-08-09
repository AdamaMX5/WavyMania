import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Order, Product } from '../types'
import { useAuth } from '../auth/AuthContext'
import * as marketClient from './marketClient'
import type { CreateOrderInput } from './marketClient'

interface MarketContextValue {
  products: Product[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  myOrders: Order[]
  ordersLoading: boolean
  buy: (productId: string, input: CreateOrderInput) => Promise<{ orderId: string; checkoutUrl: string }>
}

const MarketContext = createContext<MarketContextValue | null>(null)

export function MarketProvider({ children }: { children: ReactNode }) {
  const { status, accessToken } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // limit: 100 (the backend's max) — no pagination UI yet, mirrors
      // WavesContext's own rationale for the same choice.
      const { items } = await marketClient.listProducts({ limit: 100 })
      setProducts(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Auth-driven load, guarded against a stale response landing after a newer
  // run already reset state (e.g. a fast logout-then-different-login) —
  // same `cancelled` pattern as AvatarContext's load effect.
  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      setMyOrders([])
      setOrdersLoading(false)
      return
    }
    let cancelled = false
    setOrdersLoading(true)
    marketClient
      .myOrders(accessToken, { limit: 50 })
      .then(({ items }) => {
        if (!cancelled) setMyOrders(items)
      })
      .catch(() => {
        // "Meine Käufe" degrades to empty rather than blocking the profile page.
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, accessToken])

  const value = useMemo<MarketContextValue>(
    () => ({
      products,
      loading,
      error,
      refresh,
      myOrders,
      ordersLoading,

      buy: async (productId, input) => {
        if (!accessToken) throw new Error('Bitte melde dich an, um zu kaufen.')
        const result = await marketClient.createOrder(productId, input, accessToken)
        // Best-effort refresh so "Meine Käufe" picks up the new pendingPayment
        // order without waiting for a full remount. Fire-and-forget and
        // deliberately not routed through the effect above — accessToken
        // here is the one that just succeeded, so there's no staleness to
        // guard against.
        marketClient
          .myOrders(accessToken, { limit: 50 })
          .then(({ items }) => setMyOrders(items))
          .catch(() => {})
        return result
      },
    }),
    [products, loading, error, refresh, myOrders, ordersLoading, accessToken],
  )

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}

export function useMarket() {
  const ctx = useContext(MarketContext)
  if (!ctx) throw new Error('useMarket must be used within MarketProvider')
  return ctx
}
