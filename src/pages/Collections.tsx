import { useMemo, useState } from 'react'
import {
  audiences,
  prices,
  qualities,
  searchCollections,
  styles,
} from '../data/collections'

export function Collections() {
  const [query, setQuery] = useState('')
  const [style, setStyle] = useState('')
  const [quality, setQuality] = useState('')
  const [price, setPrice] = useState('')
  const [audience, setAudience] = useState('')

  const results = useMemo(
    () =>
      searchCollections(query, {
        style: style || undefined,
        quality: quality || undefined,
        price: price || undefined,
        audience: audience || undefined,
      }),
    [query, style, quality, price, audience],
  )

  const clearFilters = () => {
    setQuery('')
    setStyle('')
    setQuality('')
    setPrice('')
    setAudience('')
  }

  const hasFilters = Boolean(query || style || quality || price || audience)

  return (
    <div className="stack">
      <section className="card">
        <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>
          📚 Collections Database
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Every Clothing Brand launch option with the correct attributes. Filter or search to find
          what you need.
        </p>

        <div className="filters">
          <div className="field">
            <label className="field-label" htmlFor="col-search">
              Search
            </label>
            <input
              id="col-search"
              className="input"
              type="search"
              placeholder="Name or attribute…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-style">
              Style
            </label>
            <select
              id="f-style"
              className="select"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="">All</option>
              {styles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-quality">
              Quality
            </label>
            <select
              id="f-quality"
              className="select"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="">All</option>
              {qualities.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-price">
              Price
            </label>
            <select
              id="f-price"
              className="select"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            >
              <option value="">All</option>
              {prices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-audience">
              Audience
            </label>
            <select
              id="f-audience"
              className="select"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="">All</option>
              {audiences.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear
          </button>
        </div>
      </section>

      <div className="row">
        <span className="results-count">
          Showing <strong style={{ color: 'var(--text)' }}>{results.length}</strong> collection
          {results.length === 1 ? '' : 's'}
        </span>
      </div>

      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {results.length === 0 ? (
          <div className="empty-state">No collections match your filters.</div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="collections">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Style</th>
                  <th>Quality</th>
                  <th>Price</th>
                  <th>Audience</th>
                </tr>
              </thead>
              <tbody>
                {results.map((c, i) => (
                  <tr key={`${c.name}-${c.style}-${c.quality}-${c.price}-${c.audience}-${i}`}>
                    <td className="collection-name">{c.name}</td>
                    <td>
                      <span className="chip chip-style">{c.style}</span>
                    </td>
                    <td>
                      <span className="chip chip-quality">{c.quality}</span>
                    </td>
                    <td>
                      <span className="chip chip-price">{c.price}</span>
                    </td>
                    <td>
                      <span className="chip chip-audience">{c.audience}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
