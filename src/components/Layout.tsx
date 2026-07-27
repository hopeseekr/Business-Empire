import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { businesses } from '../data/businesses'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/clothing': 'Clothing Brand',
  '/clothing/collections': 'Collections Database',
  '/clothing/launch': 'Launch Helper',
  '/investments': 'Investments',
}

const isInvestments = (path: string) => path.startsWith('/investments')
const isClothing = (path: string) => path.startsWith('/clothing')

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'Business Empire'

  const close = () => setSidebarOpen(false)

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={close}
        aria-hidden={!sidebarOpen}
      />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <NavLink to="/" className="brand" onClick={close}>
          <div className="brand-mark" aria-hidden>
            🏢
          </div>
          <div className="brand-text">
            <span className="brand-title">Business Empire</span>
            <span className="brand-sub">Companion</span>
          </div>
        </NavLink>

        <nav>
          <div className="nav-section-label">Overview</div>
          <ul className="nav-list">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={close}
              >
                <span className="nav-icon" aria-hidden="true">🏠</span>
                Dashboard
              </NavLink>
            </li>
          </ul>

          <div className="nav-section-label" style={{ marginTop: '1.25rem' }}>
            Businesses
          </div>
          <ul className="nav-list">
            {businesses.map((b) => (
              <li key={b.id}>
                <NavLink
                  to={`/${b.id}`}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={close}
                >
                <span className="nav-icon" aria-hidden="true">
                  {b.icon}
                </span>
                  {b.shortName}
                  {b.status === 'coming-soon' && <span className="badge-soon">Soon</span>}
                </NavLink>
              </li>
            ))}
          </ul>

          {isClothing(location.pathname) && (
            <>
              <div className="nav-section-label" style={{ marginTop: '1.25rem' }}>
                Clothing Brand
              </div>
              <ul className="nav-list">
                <li>
                  <NavLink
                    to="/clothing"
                    end
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={close}
                  >
                    <span className="nav-icon" aria-hidden="true">📊</span>
                    Overview
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/clothing/launch"
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={close}
                  >
                    <span className="nav-icon" aria-hidden="true">🚀</span>
                    Launch Helper
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/clothing/collections"
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={close}
                  >
                    <span className="nav-icon" aria-hidden="true">📚</span>
                    All Collections
                  </NavLink>
                </li>
              </ul>
            </>
          )}

          {isInvestments(location.pathname) && (
            <>
              <div className="nav-section-label" style={{ marginTop: '1.25rem' }}>
                Investments
              </div>
              <ul className="nav-list">
                <li>
                  <NavLink
                    to="/investments"
                    end
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={close}
                  >
                    <span className="nav-icon" aria-hidden="true">🎯</span>
                    Trade Helper
                  </NavLink>
                </li>
              </ul>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          Perfect launches without ads.
          <br />
          <strong>{businesses.filter((b) => b.status === 'live').length}</strong> business live ·{' '}
          more coming.
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button
              type="button"
              className="mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <span aria-hidden="true">☰</span>
            </button>
            <h1 className="topbar-title">{title}</h1>
          </div>
          <div className="topbar-meta">Business Empire: RichMan</div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
