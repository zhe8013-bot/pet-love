import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '../styles/theme.css'
import { PetDataProvider } from '../data/PetDataProvider'
import { HomePage } from '../features/home/HomePage'
import { AppShell } from './AppShell'

const HealthPage = lazy(() => import('../features/health/HealthPage').then((module) => ({ default: module.HealthPage })))
const LifePage = lazy(() => import('../features/life/LifePage').then((module) => ({ default: module.LifePage })))
const PetProfilePage = lazy(() => import('../features/pets/PetProfilePage').then((module) => ({ default: module.PetProfilePage })))
const MemoryPage = lazy(() => import('../features/memories/MemoryPage').then((module) => ({ default: module.MemoryPage })))

function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate replace to={`${to}${search}`} />
}

export function App() {
  return (
    <BrowserRouter>
      <PetDataProvider>
        <Suspense fallback={<div className="route-loading">正在打开这段记录…</div>}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="profile" element={<PetProfilePage />} />
              <Route path="daily" element={<LifePage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="memories" element={<MemoryPage />} />
              <Route path="life" element={<LegacyRedirect to="/daily" />} />
              <Route path="pets" element={<LegacyRedirect to="/profile" />} />
              <Route path="*" element={<Navigate replace to="/" />} />
            </Route>
          </Routes>
        </Suspense>
      </PetDataProvider>
    </BrowserRouter>
  )
}
