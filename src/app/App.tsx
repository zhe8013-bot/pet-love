import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import '../styles/theme.css'
import { PetDataProvider } from '../data/PetDataProvider'
import { HomePage } from '../features/home/HomePage'
import { AppShell } from './AppShell'

const HealthPage = lazy(() => import('../features/health/HealthPage').then((module) => ({ default: module.HealthPage })))
const LifePage = lazy(() => import('../features/life/LifePage').then((module) => ({ default: module.LifePage })))
const MemoryPage = lazy(() => import('../features/memories/MemoryPage').then((module) => ({ default: module.MemoryPage })))

export function App() {
  return (
    <BrowserRouter>
      <PetDataProvider>
        <Suspense fallback={<div className="route-loading">正在打开这段记录…</div>}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="life" element={<LifePage />} />
              <Route path="memories" element={<MemoryPage />} />
            </Route>
          </Routes>
        </Suspense>
      </PetDataProvider>
    </BrowserRouter>
  )
}
