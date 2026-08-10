import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { EventsProvider } from './events/EventsContext'
import { LoginForm } from './auth/LoginForm'
import { ResetPasswordPage } from './auth/ResetPasswordPage'
import { NoAccessView } from './components/NoAccessView'
import { TopNav } from './components/TopNav'
import { EventListView } from './events/EventListView'
import { CreateEventView } from './events/CreateEventView'
import { EventDetailView } from './events/EventDetailView'

function Gate({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <LoginForm />
      </div>
    )
  }
  // Role assignment is admin-only (AuthService.md `/admin/set_roles`) — a
  // freshly registered account never has `organizer` by itself.
  if (!user?.roles.includes('organizer')) {
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
        <BrowserRouter>
          <div className="min-h-screen bg-neutral-950 text-neutral-100">
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route
                path="*"
                element={
                  <Gate>
                    <TopNav />
                    <main>
                      <Routes>
                        <Route path="/" element={<EventListView />} />
                        <Route path="/erstellen" element={<CreateEventView />} />
                        <Route path="/events/:id" element={<EventDetailView />} />
                      </Routes>
                    </main>
                  </Gate>
                }
              />
            </Routes>
          </div>
        </BrowserRouter>
      </EventsProvider>
    </AuthProvider>
  )
}
