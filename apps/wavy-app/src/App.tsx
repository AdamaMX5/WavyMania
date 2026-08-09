import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { WavesProvider } from './waves/WavesContext'
import { AvatarProvider } from './avatar/AvatarContext'
import { BottomNav } from './components/BottomNav'
import { WavesView } from './views/WavesView'
import { MapView } from './views/MapView'
import { CreateView } from './views/CreateView'
import { EditView } from './views/EditView'
import { MarketView } from './views/MarketView'
import { ProfileView } from './views/ProfileView'
import { ProfileEditView } from './views/ProfileEditView'
import { SettingsView } from './views/SettingsView'
import { ResetPasswordPage } from './auth/ResetPasswordPage'

export default function App() {
  return (
    <AuthProvider>
      <WavesProvider>
        <AvatarProvider>
          <BrowserRouter>
            <div className="mx-auto flex min-h-screen max-w-md flex-col bg-neutral-950 text-neutral-100">
              <main className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<WavesView />} />
                  <Route path="/karte" element={<MapView />} />
                  <Route path="/erstellen" element={<CreateView />} />
                  <Route path="/waves/:id/bearbeiten" element={<EditView />} />
                  <Route path="/marktplatz" element={<MarketView />} />
                  <Route path="/profil" element={<ProfileView />} />
                  <Route path="/profil/bearbeiten" element={<ProfileEditView />} />
                  <Route path="/profil/einstellungen" element={<SettingsView />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Routes>
              </main>
              <BottomNav />
            </div>
          </BrowserRouter>
        </AvatarProvider>
      </WavesProvider>
    </AuthProvider>
  )
}
