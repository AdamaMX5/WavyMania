// TicketService only supports 'eur' currently, but this stays currency-aware
// rather than hardcoding the symbol (mirrors wavy-app's src/lib/format.ts).
export function formatPrice(cents: number, currency: string) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency })
}
