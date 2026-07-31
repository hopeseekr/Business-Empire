import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { businesses } from '../data/businesses'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/clothing': 'Clothing Brand',
  '/clothing/collections': 'Collections Database',
  '/clothing/launch': 'Launch Helper',
  '/investments': 'Investments',
  '/investments/screening': 'Bulk Screening',
}

const isInvestments = (path: string) => path.startsWith('/investments')
const isClothing = (path: string) => path.startsWith('/clothing')

/** Minify sidebar on dense tool pages so content gets more room. */
const shouldMinifySidebar = (path: string) =>
  isInvestments(path) || isClothing(path)

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'Business Empire'
  const minified = shouldMinifySidebar(location.pathname)

  const close = () => setSidebarOpen(false)

  return (
    <div className={`app-shell${minified ? ' sidebar-minified' : ''}`}>
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={close}
        aria-hidden={!sidebarOpen}
      />

      <aside
        className={`sidebar${sidebarOpen ? ' open' : ''}${minified ? ' minified' : ''}`}
      >
        <NavLink to="/" className="brand" onClick={close} title="Business Empire">
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
                title="Dashboard"
              >
                <span className="nav-icon" aria-hidden="true">
                  🏠
                </span>
                <span className="nav-label">Dashboard</span>
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
                  title={b.name}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {b.icon}
                  </span>
                  <span className="nav-label">{b.shortName}</span>
                  {b.status === 'coming-soon' && (
                    <span className="badge-soon">Soon</span>
                  )}
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
                    title="Overview"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      📊
                    </span>
                    <span className="nav-label">Overview</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/clothing/launch"
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={close}
                    title="Launch Helper"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      🚀
                    </span>
                    <span className="nav-label">Launch Helper</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/clothing/collections"
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    onClick={close}
                    title="All Collections"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      📚
                    </span>
                    <span className="nav-label">All Collections</span>
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
                    title="Trade Helper"
                  >
                    <span className="nav-icon" aria-hidden="true">
                      🎯
                    </span>
                    <span className="nav-label">Trade Helper</span>
                  </NavLink>
                </li>
              </ul>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <strong>{businesses.filter((b) => b.status === 'live').length}</strong>{' '}
          business live · more coming.
          <p className="grok-credit sidebar-grok-credit">
            98% coded via{' '}
            <a href="https://x.ai/cli" target="_blank" rel="noopener noreferrer">
              Grok Build
            </a>
            <br />
            <a
              href="https://github.com/hopeseekr/business-empire/"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repo
            </a>
          </p>
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
        <footer className="site-footer">
          <p className="grok-credit">
            <strong>98% coded by{' '}
            <a href="https://grok.com" target="_blank" rel="noopener noreferrer">
              Grok
            </a>{' '}
            AI via{' '}
            <a href="https://x.ai/cli" target="_blank" rel="noopener noreferrer">
              Grok Build
            </a>
            <br />
            <a
              href="https://github.com/hopeseekr/business-empire/"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repo
            </a>
            </strong>
          </p>
        </footer>
      </div>
    </div>
  )
}
