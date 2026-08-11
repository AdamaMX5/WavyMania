// WavyBusiness serves two independent merchant-facing surfaces sharing one login:
// TicketService event management (role `organizer`) and MarketService product/offer
// management (role `merchant`/`creator`). Kept in their own module (not in
// ProductsContext.tsx or App.tsx) so App.tsx and TopNav.tsx can both import it
// without forming a circular dependency between the two.
export const MERCHANT_ROLES = ['merchant', 'creator']

export function isOrganizer(roles: string[] | undefined) {
  return !!roles?.includes('organizer')
}

export function isMerchant(roles: string[] | undefined) {
  return !!roles && MERCHANT_ROLES.some((role) => roles.includes(role))
}
