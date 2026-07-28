import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { ClothingOverview } from './pages/ClothingOverview'
import { LaunchHelper } from './pages/LaunchHelper'
import { Collections } from './pages/Collections'
import { Investments } from './pages/Investments'
import { BulkScreening } from './pages/BulkScreening'

/**
 * HashRouter keeps routes after `#` (e.g. /business-empire/#/investments).
 * The server only ever sees /business-empire/ (or index.html), so a hard
 * refresh never 404s/500s when SPA try_files is missing on the host.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clothing" element={<ClothingOverview />} />
          <Route path="clothing/launch" element={<LaunchHelper />} />
          <Route path="clothing/collections" element={<Collections />} />
          <Route path="investments" element={<Investments />} />
          <Route path="investments/screening" element={<BulkScreening />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
