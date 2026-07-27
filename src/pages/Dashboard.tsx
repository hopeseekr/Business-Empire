import { Link } from 'react-router-dom'
import { businesses } from '../data/businesses'
import { collections } from '../data/collections'
import { bullion, cryptos, stocks } from '../data/investments'

export function Dashboard() {
  const live = businesses.filter((b) => b.status === 'live')
  const soon = businesses.filter((b) => b.status === 'coming-soon')
  const assetCount = stocks.length + cryptos.length + bullion.length

  return (
    <div className="stack">
      <section className="hero-banner">
        <h1>Build your empire smarter</h1>
        <p>
          A companion for <strong style={{ color: 'var(--text)' }}>Business Empire: RichMan</strong>.
          Look up perfect Clothing Brand launch answers, browse every collection, and run your
          stock, crypto &amp; bullion BUY / HOLD / SELL helper from years of tracked ranges.
        </p>
        <div className="row">
          <Link to="/clothing/launch" className="btn btn-cta">
            🚀 Launch Helper
          </Link>
          <Link to="/investments" className="btn btn-primary">
            📈 Investments
          </Link>
          <Link to="/clothing/collections" className="btn btn-ghost">
            Browse collections
          </Link>
        </div>
      </section>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">Businesses live</div>
          <div className="stat-value accent">{live.length}</div>
          <div className="stat-hint">
            {live.map((b) => b.shortName).join(' · ')}
            {soon.length > 0 ? ` · ${soon.length} soon` : ''}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clothing collections</div>
          <div className="stat-value cta">{collections.length}</div>
          <div className="stat-hint">Full attribute answers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tracked assets</div>
          <div className="stat-value">{assetCount}</div>
          <div className="stat-hint">
            {stocks.length} stocks · {cryptos.length} crypto · {bullion.length} bullion
          </div>
        </div>
      </div>

      <section>
        <h2 className="section-title">Your businesses</h2>
        <div className="grid-2">
          {businesses.map((b) =>
            b.status === 'live' ? (
              <Link key={b.id} to={`/${b.id}`} className="card business-card">
                <div className="business-icon">{b.icon}</div>
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>{b.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {b.description}
                  </p>
                </div>
                <span className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  Open →
                </span>
              </Link>
            ) : (
              <div key={b.id} className="card business-card locked">
                <div className="business-icon orange">{b.icon}</div>
                <div>
                  <div className="row" style={{ marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0 }}>{b.name}</h3>
                    <span className="badge-soon">Soon</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {b.description}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="card card-muted">
        <h2 className="section-title">Quick tip — Clothing Brand</h2>
        <ul className="mechanics-list">
          <li>
            You can launch a collection about every <strong>8 hours</strong>.
          </li>
          <li>
            A launch pays extra income for roughly <strong>48 hours</strong>.
          </li>
          <li>
            Pick the correct <strong>Style</strong>, <strong>Quality</strong>, <strong>Price</strong>
            , and <strong>Audience</strong> for the collection name shown in-game.
          </li>
          <li>
            Use the <Link to="/clothing/launch">Launch Helper</Link> while the game is open — type
            the name and copy the answers.
          </li>
        </ul>
      </section>
    </div>
  )
}
