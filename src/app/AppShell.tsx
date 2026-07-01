import {
  ChartLineUp,
  CaretDown,
  FirstAidKit,
  House,
  IdentificationCard,
  Images,
  PawPrint,
  Plus,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { usePetData } from '../data/PetDataProvider'

const navItems = [
  { to: '/', label: '首页', icon: House },
  { to: '/daily', label: '日常', icon: ChartLineUp },
  { to: '/health', label: '健康', icon: FirstAidKit },
  { to: '/memories', label: '回忆', icon: Images },
  { to: '/profile', label: '档案', icon: IdentificationCard },
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
          <div className="quick-add-menu" role="menu" aria-label="快速记录菜单">
            <Link to="/daily?new=feeding" onClick={() => setQuickOpen(false)}>记录喂食</Link>
            <Link to="/daily?new=water" onClick={() => setQuickOpen(false)}>记录饮水</Link>
            <Link to="/daily?new=weight" onClick={() => setQuickOpen(false)}>记录体重</Link>
            <Link to="/daily?new=consumption" onClick={() => setQuickOpen(false)}>记录消耗</Link>
            <Link to="/health?new=1" onClick={() => setQuickOpen(false)}>新增病历</Link>
            <Link to="/daily?new=photo" onClick={() => setQuickOpen(false)}>添加照片 / 回忆</Link>
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
