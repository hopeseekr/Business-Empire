import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { ClothingOverview } from './pages/ClothingOverview'
import { LaunchHelper } from './pages/LaunchHelper'
import { Collections } from './pages/Collections'
import { Investments } from './pages/Investments'

// Vite injects base from vite.config (e.g. "/business-empire/"); Router wants no trailing slash
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export default function App() {
  return (
    <BrowserRouter basename={basename === '/' ? undefined : basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clothing" element={<ClothingOverview />} />
          <Route path="clothing/launch" element={<LaunchHelper />} />
          <Route path="clothing/collections" element={<Collections />} />
          <Route path="investments" element={<Investments />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
