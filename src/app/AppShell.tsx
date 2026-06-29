import {
  ChartLineUp,
  CaretDown,
  FirstAidKit,
  House,
  IdentificationCard,
  PawPrint,
  Plus,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { usePetData } from '../data/PetDataProvider'

const navItems = [
  { to: '/', label: '首页', icon: House },
  { to: '/pets', label: '宠物档案', icon: IdentificationCard },
  { to: '/health', label: '健康档案', icon: FirstAidKit },
  { to: '/life', label: '生活记录', icon: ChartLineUp },
]

function AppTopbar() {
  const { pets, currentPetId, selectPet } = usePetData()
  const [quickOpen, setQuickOpen] = useState(false)

  return (
    <header className="app-topbar">
      <label className="pet-switcher">
        <img src={pets.find((pet) => pet.id === currentPetId)?.avatar} alt="" />
        <select aria-label="当前宠物" value={currentPetId} onChange={(event) => selectPet(event.target.value)}>
          {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
        </select>
        <CaretDown size={14} aria-hidden="true" />
      </label>
      <div className="quick-add-wrap">
        <button className="button primary compact" aria-expanded={quickOpen} onClick={() => setQuickOpen((open) => !open)}>
          <Plus size={17} />快速记录
        </button>
        {quickOpen && (
          <div className="quick-add-menu">
            <Link to="/health?new=1" onClick={() => setQuickOpen(false)}>新增病历</Link>
            <Link to="/life?new=consumption" onClick={() => setQuickOpen(false)}>记录消耗</Link>
            <Link to="/life?new=weight" onClick={() => setQuickOpen(false)}>记录体重</Link>
          </div>
        )}
      </div>
    </header>
  )
}

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="brand-mark"><PawPrint weight="fill" /></span>
          <div>
            <strong>PetPlanet</strong>
            <span>Lantern Garden</span>
          </div>
        </div>
        <nav className="primary-nav" aria-label="主导航">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <Link className="sidebar-add" to="/?addPet=1">
          <Plus size={20} />
          添加宠物
        </Link>
      </aside>

      <main className="app-main">
        <AppTopbar />
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="移动端导航">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
