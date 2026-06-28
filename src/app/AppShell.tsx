import {
  ChartLineUp,
  FirstAidKit,
  House,
  PawPrint,
  Plus,
  Sparkle,
} from '@phosphor-icons/react'
import { Link, NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: '首页', icon: House },
  { to: '/health', label: '健康档案', icon: FirstAidKit },
  { to: '/life', label: '生活记录', icon: ChartLineUp },
  { to: '/memories', label: '记忆星河', icon: Sparkle },
]

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
