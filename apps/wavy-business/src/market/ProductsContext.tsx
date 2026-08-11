import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MarketProduct } from '../types'
import { useAuth } from '../auth/AuthContext'
import { isMerchant } from '../auth/roles'
import * as marketClient from './marketClient'
import type { ProductInput, ProductPatchInput } from './marketClient'

interface ProductsContextValue {
  products: MarketProduct[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createProduct: (input: ProductInput) => Promise<MarketProduct>
  updateProduct: (id: string, input: ProductPatchInput) => Promise<MarketProduct>
  publishProduct: (id: string) => Promise<MarketProduct>
}

const ProductsContext = createContext<ProductsContextValue | null>(null)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const { accessToken, status, user } = useAuth()
  // GET /me/products is merchant/creator-only — loading it for an anonymous or
  // organizer-only session would just provoke a 401/403 (mirrors EventsProvider).
  const userIsMerchant = status === 'authenticated' && isMerchant(user?.roles)
  const [products, setProducts] = useState<MarketProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!accessToken || !userIsMerchant) return
    setLoading(true)
    setError(null)
    try {
      // limit: 100 (the backend's max) — no pagination UI yet.
      const { items } = await marketClient.myProducts(accessToken, { limit: 100 })
      setProducts(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkte konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [accessToken, userIsMerchant])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requireToken = useCallback(() => {
    if (!accessToken) throw new Error('Bitte melde dich an, um diese Aktion auszuführen.')
    return accessToken
  }, [accessToken])

  const value = useMemo<ProductsContextValue>(
    () => ({
      products,
      loading,
      error,
      refresh,

      createProduct: async (input) => {
        const token = requireToken()
        const created = await marketClient.createProduct(input, token)
        setProducts((prev) => [created, ...prev])
        return created
      },

      updateProduct: async (id, input) => {
        const token = requireToken()
        const updated = await marketClient.patchProduct(id, input, token)
        setProducts((prev) => prev.map((product) => (product.id === id ? updated : product)))
        return updated
      },

      publishProduct: async (id) => {
        const token = requireToken()
        const published = await marketClient.publishProduct(id, token)
        setProducts((prev) => prev.map((product) => (product.id === id ? published : product)))
        return published
      },
    }),
    [products, loading, error, refresh, requireToken],
  )

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts() {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider')
  return ctx
}
