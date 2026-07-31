import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { WavesProvider } from './mock/WavesContext'
import { BottomNav } from './components/BottomNav'
import { WavesView } from './views/WavesView'
import { MapView } from './views/MapView'
import { CreateView } from './views/CreateView'
import { MarketView } from './views/MarketView'
import { ProfileView } from './views/ProfileView'
import { ResetPasswordPage } from './auth/ResetPasswordPage'

export default function App() {
  return (
    <AuthProvider>
      <WavesProvider>
        <BrowserRouter>
          <div className="mx-auto flex min-h-screen max-w-md flex-col bg-neutral-950 text-neutral-100">
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<WavesView />} />
                <Route path="/karte" element={<MapView />} />
                <Route path="/erstellen" element={<CreateView />} />
                <Route path="/marktplatz" element={<MarketView />} />
                <Route path="/profil" element={<ProfileView />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Routes>
            </main>
            <BottomNav />
          </div>
        </BrowserRouter>
      </WavesProvider>
    </AuthProvider>
  )
}
