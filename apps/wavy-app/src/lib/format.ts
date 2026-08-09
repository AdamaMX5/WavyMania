// MarketService only supports 'eur' currently (see MarketService.md), but
// this stays currency-aware rather than hardcoding the symbol, since Order
// has no currency field of its own and callers pass 'EUR' explicitly there.
export function formatPrice(cents: number, currency: string) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency })
}
