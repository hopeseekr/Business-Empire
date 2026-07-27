import { useMemo, useState } from 'react'
import { searchCollections } from '../data/collections'
import type { ClothingCollection } from '../types'

function AnswerPanel({ collection }: { collection: ClothingCollection }) {
  return (
    <div className="stack" style={{ gap: '0.85rem' }}>
      <div>
        <div className="field-label">Collection</div>
        <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.35rem' }}>{collection.name}</h2>
      </div>
      <div className="answer-grid">
        <div className="answer-card style">
          <div className="label">Style</div>
          <div className="value">{collection.style}</div>
        </div>
        <div className="answer-card quality">
          <div className="label">Quality</div>
          <div className="value">{collection.quality}</div>
        </div>
        <div className="answer-card price">
          <div className="label">Price</div>
          <div className="value">{collection.price}</div>
        </div>
        <div className="answer-card audience">
          <div className="label">Audience / Target</div>
          <div className="value">{collection.audience}</div>
        </div>
      </div>
      <div className="hint-box">
        Enter these four values in the game for a perfect launch. Income still scales with how much
        you invest.
      </div>
    </div>
  )
}

export function LaunchHelper() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ClothingCollection | null>(null)
  const [focusedMatch, setFocusedMatch] = useState<string | null>(null)

  const matches = useMemo(() => searchCollections(query), [query])

  const exactOrTop =
    selected ??
    (matches.length === 1
      ? matches[0]
      : matches.find((m) => m.name.toLowerCase() === query.trim().toLowerCase()) ?? null)

  return (
    <div className="stack">
      <section className="card">
        <h2 className="section-title" style={{ marginBottom: '0.35rem' }}>
          <span aria-hidden="true">🚀</span> Launch Helper
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Type the collection name from the game. Tap a match to lock in the perfect Style, Quality,
          Price, and Audience.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="launch-search">
            Collection name
          </label>
          <input
            id="launch-search"
            className="input"
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="e.g. Cyberpunk Fashion, Beach Season, Timeless Classic…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
          />
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Matches
            </h3>
            <span className="results-count spacer">
              {query.trim() ? `${matches.length} shown` : 'Type to search'}
            </span>
          </div>

          {!query.trim() && (
            <div className="empty-state">
              Start typing the in-game collection name.
              <br />
              Partial matches work.
            </div>
          )}

          {query.trim() && matches.length === 0 && (
            <div className="empty-state">No collections match “{query}”.</div>
          )}

          {matches.length > 0 && (
            <div className="table-wrap">
              <table className="collections">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Style</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((c, i) => {
                    const isSelected =
                      exactOrTop?.name === c.name &&
                      exactOrTop.style === c.style &&
                      exactOrTop.quality === c.quality &&
                      exactOrTop.price === c.price &&
                      exactOrTop.audience === c.audience
                    return (
                      <tr
                        key={`${c.name}-${c.style}-${c.price}-${i}`}
                        className={isSelected ? 'selected' : undefined}
                        style={{
                          cursor: 'pointer',
                          outline: focusedMatch === c.name ? '2px solid var(--accent)' : undefined,
                          outlineOffset: '-2px',
                        }}
                        onClick={() => setSelected(c)}
                      >
                        <td className="collection-name">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            style={{
                              border: 0,
                              padding: 0,
                              background: 'transparent',
                              color: 'inherit',
                              font: 'inherit',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                            onFocus={() => setFocusedMatch(c.name)}
                            onBlur={() => setFocusedMatch(null)}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelected(c)
                            }}
                          >
                            {c.name}
                          </button>
                        </td>
                        <td>
                          <span className="chip chip-style">{c.style}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          {exactOrTop ? (
            <AnswerPanel collection={exactOrTop} />
          ) : (
            <div className="empty-state">
              Answers appear here once you select a collection.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
