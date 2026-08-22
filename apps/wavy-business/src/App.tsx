import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { isOrganizer, isMerchant } from './auth/roles'
import { EventsProvider } from './events/EventsContext'
import { ProductsProvider } from './market/ProductsContext'
import { LoginForm } from './auth/LoginForm'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { NoAccessView } from './components/NoAccessView'
import { TopNav } from './components/TopNav'
import { FeedbackWidget } from './feedback/FeedbackWidget'
import { EventListView } from './events/EventListView'
import { CreateEventView } from './events/CreateEventView'
import { EventDetailView } from './events/EventDetailView'
import { ProductListView } from './market/ProductListView'
import { CreateProductView } from './market/CreateProductView'
import { ProductDetailView } from './market/ProductDetailView'
import { PayoutsView } from './payments/PayoutsView'
import { OnboardingRefreshRedirect } from './payments/OnboardingRefreshRedirect'

// "/" defaults to the Events list — but a merchant-only account (no `organizer`
// role) has no Events nav link and would just land on a permanently-empty list,
// so it's redirected straight to its actual home surface instead.
function Home() {
  const { user } = useAuth()
  if (!isOrganizer(user?.roles) && isMerchant(user?.roles)) {
    return <Navigate to="/produkte" replace />
  }
  return <EventListView />
}

function Gate({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()

  // Covers the brief silent-refresh bootstrap (see AuthContext.tsx) — shown
  // instead of the login form so an already-logged-in merchant/organizer
  // never sees a login flash before their refresh_token cookie resolves into
  // a fresh session.
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-neutral-500">
        Lädt …
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoginForm />
      </div>
    )
  }
  // Role assignment is admin-only (AuthService.md `/admin/set_roles`) — a
  // freshly registered account never has `organizer`/`merchant`/`creator` by itself.
  if (!isOrganizer(user?.roles) && !isMerchant(user?.roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <NoAccessView />
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <EventsProvider>
        <ProductsProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-neutral-950 text-neutral-100">
              <Routes>
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="*"
                  element={
                    <Gate>
                      <TopNav />
                      <FeedbackWidget />
                      <main>
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/erstellen" element={<CreateEventView />} />
                          <Route path="/events/:id" element={<EventDetailView />} />
                          <Route path="/produkte" element={<ProductListView />} />
                          <Route path="/produkte/neu" element={<CreateProductView />} />
                          <Route path="/produkte/:id" element={<ProductDetailView />} />
                          <Route path="/auszahlungen" element={<PayoutsView />} />
                          {/* Exact paths PaymentService's onboardingUrls() builds against
                              APP_BASE_URL — Stripe redirects the merchant back to one of
                              these after the hosted onboarding flow (see PayoutsView.tsx). */}
                          <Route path="/merchant/onboarding/complete" element={<Navigate to="/auszahlungen?status=returned" replace />} />
                          <Route path="/merchant/onboarding/refresh" element={<OnboardingRefreshRedirect />} />
                        </Routes>
                      </main>
                    </Gate>
                  }
                />
              </Routes>
            </div>
          </BrowserRouter>
        </ProductsProvider>
      </EventsProvider>
    </AuthProvider>
  )
}
