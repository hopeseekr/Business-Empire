import { Link } from 'react-router-dom'
import { collections, styles, qualities, prices, audiences } from '../data/collections'

export function ClothingOverview() {
  return (
    <div className="stack">
      <section className="hero-banner">
        <h1>👕 Clothing Brand</h1>
        <p>
          Merger business from a large shop chain and a small factory. Launch collections on a timer
          and max income by matching every attribute correctly.
        </p>
        <div className="row">
          <Link to="/clothing/launch" className="btn btn-cta">
            🚀 Open Launch Helper
          </Link>
          <Link to="/clothing/collections" className="btn btn-primary">
            📚 All collections
          </Link>
        </div>
      </section>

      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-label">Collections</div>
          <div className="stat-value accent">{collections.length}</div>
          <div className="stat-hint">In the database</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Styles</div>
          <div className="stat-value">{styles.length}</div>
          <div className="stat-hint">Business, Street, Tech…</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Qualities</div>
          <div className="stat-value">{qualities.length}</div>
          <div className="stat-hint">Budget → Exclusive</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Launch window</div>
          <div className="stat-value cta">8h</div>
          <div className="stat-hint">~48h income boost</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">How launches work</h2>
          <ul className="mechanics-list">
            <li>
              When a new collection is available, the game shows its <strong>name</strong>.
            </li>
            <li>
              You choose <strong>Style</strong>, <strong>Quality</strong>, <strong>Price</strong>, and{' '}
              <strong>Target / Audience</strong>.
            </li>
            <li>
              Correct picks + investment level decide how much extra income you earn for ~48 hours.
            </li>
            <li>
              The rotation is long (~60 launches with a few repeats). Use the helper instead of ads.
            </li>
          </ul>
          <div className="hint-box" style={{ marginTop: '1rem' }}>
            <strong>Tip:</strong> Search by partial name — e.g. type “grunge” or “cyberpunk” while
            launching.
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Attribute options</h2>
          <div className="stack" style={{ gap: '0.85rem' }}>
            <div>
              <div className="field-label" style={{ marginBottom: '0.4rem' }}>
                Style
              </div>
              <div className="row">
                {styles.map((s) => (
                  <span key={s} className="chip chip-style">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: '0.4rem' }}>
                Quality
              </div>
              <div className="row">
                {qualities.map((s) => (
                  <span key={s} className="chip chip-quality">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: '0.4rem' }}>
                Price
              </div>
              <div className="row">
                {prices.map((s) => (
                  <span key={s} className="chip chip-price">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: '0.4rem' }}>
                Audience
              </div>
              <div className="row">
                {audiences.map((s) => (
                  <span key={s} className="chip chip-audience">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card card-muted">
        <h2 className="section-title">Brand growth (game reference)</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Approximate upgrade path after the merger (values from community wiki — always verify
          in-game):
        </p>
        <div className="table-wrap">
          <table className="collections">
            <thead>
              <tr>
                <th>Level</th>
                <th>Focus</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="collection-name">1</td>
                <td>Merger complete</td>
                <td>Base hourly income starts here</td>
              </tr>
              <tr>
                <td className="collection-name">2</td>
                <td>Fashion designers</td>
                <td>Starter collection development</td>
              </tr>
              <tr>
                <td className="collection-name">3+</td>
                <td>Production & growth</td>
                <td>Factories, materials, scale income</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
