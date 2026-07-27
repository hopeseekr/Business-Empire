import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import {
  analyzeTrade,
  cryptos,
  formatMoney,
  formatPct,
  parseUserNumber,
  searchAssets,
  stocks,
} from '../data/investments'
import type { InvestmentAsset, InvestmentKind, TradeAction, TradeAnalysis } from '../types'

function actionMeta(action: TradeAction): { label: string; hint: string; className: string } {
  switch (action) {
    case 'BUY':
      return {
        label: 'BUY',
        hint: 'Price is below the historical average — room to run toward max.',
        className: 'action-buy',
      }
    case 'SELL':
      return {
        label: 'SELL',
        hint: 'You hold shares and price is at/above average — take profit toward max.',
        className: 'action-sell',
      }
    case 'HOLD':
      return {
        label: 'HOLD',
        hint: 'Price is at/above average and you are not holding — wait for a better entry.',
        className: 'action-hold',
      }
  }
}

function sanitizeDecimalInput(value: string): string {
  let result = ''
  let hasDecimal = false

  for (const character of value) {
    if (/\d/.test(character)) {
      result += character
    } else if (character === '.' && !hasDecimal) {
      result += character
      hasDecimal = true
    }
  }

  return result
}

function VerdictPanel({
  asset,
  analysis,
}: {
  asset: InvestmentAsset
  analysis: TradeAnalysis
}) {
  const meta = actionMeta(analysis.action)
  const potPositive = analysis.potentialPct >= 0

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <div className={`verdict-banner ${meta.className}`}>
        <div className="verdict-kicker">{asset.name}</div>
        <div className="verdict-action">{meta.label}</div>
        <p className="verdict-hint">{meta.hint}</p>
      </div>

      <div className="potential-hero">
        <div className="potential-label">Potential remaining</div>
        <div className={`potential-value ${potPositive ? 'up' : 'down'}`}>
          {formatPct(analysis.potentialPct)}
        </div>
        <div className="potential-sub">
          Upside to max: <strong>{formatMoney(analysis.upsidePerShare)}</strong> / share
          {analysis.totalUpside != null && (
            <>
              {' '}
              · Position upside: <strong>{formatMoney(analysis.totalUpside)}</strong>
            </>
          )}
        </div>
      </div>

      <div className="grid-3">
        <div className="stat-card">
          <div className="stat-label">Your price</div>
          <div className="stat-value">{formatMoney(analysis.price)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average</div>
          <div className="stat-value accent">{formatMoney(asset.average)}</div>
          <div className="stat-hint">
            {analysis.price < asset.average
              ? `${formatPct(((asset.average - analysis.price) / asset.average) * 100)} below avg`
              : analysis.price > asset.average
                ? `${formatPct(((analysis.price - asset.average) / asset.average) * 100)} above avg`
                : 'At average'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Max target</div>
          <div className="stat-value cta">{formatMoney(asset.max)}</div>
          <div className="stat-hint">Min {formatMoney(asset.min)}</div>
        </div>
      </div>

      {analysis.shares != null && analysis.shares > 0 && (
        <div className="grid-2">
          <div className="stat-card">
            <div className="stat-label">Shares</div>
            <div className="stat-value">{analysis.shares.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Position value</div>
            <div className="stat-value">
              {analysis.positionValue != null ? formatMoney(analysis.positionValue) : '—'}
            </div>
          </div>
        </div>
      )}

      <div className="range-meter card card-muted" style={{ padding: '1rem 1.15rem' }}>
        <div className="row" style={{ marginBottom: '0.5rem' }}>
          <span className="field-label" style={{ margin: 0 }}>
            Range position
          </span>
          <span className="results-count spacer">
            {Math.round(analysis.rangePosition * 100)}% of Min→Max
          </span>
        </div>
        <div className="range-track" aria-hidden>
          <div className="range-fill" style={{ width: `${analysis.rangePosition * 100}%` }} />
          <div
            className="range-marker avg"
            style={{
              left: `${((asset.average - asset.min) / (asset.max - asset.min || 1)) * 100}%`,
            }}
            title="Average"
          />
          <div
            className="range-marker now"
            style={{ left: `${analysis.rangePosition * 100}%` }}
            title="Current"
          />
        </div>
        <div className="range-labels">
          <span>Min {formatMoney(asset.min)}</span>
          <span>Avg {formatMoney(asset.average)}</span>
          <span>Max {formatMoney(asset.max)}</span>
        </div>
      </div>
    </div>
  )
}

export function Investments() {
  const [kind, setKind] = useState<InvestmentKind>('stock')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<InvestmentAsset | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [sharesInput, setSharesInput] = useState('')
  const [focusedAsset, setFocusedAsset] = useState<string | null>(null)
  const [focusPriceRequest, setFocusPriceRequest] = useState(0)
  const priceInputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => searchAssets(kind, query).slice(0, 40), [kind, query])

  // When switching stock/crypto tab, clear selection and inputs.
  useEffect(() => {
    setSelected(null)
    setQuery('')
    setPriceInput('')
    setSharesInput('')
  }, [kind])

  useEffect(() => {
    if (focusPriceRequest > 0) {
      priceInputRef.current?.focus()
      setFocusPriceRequest(0)
    }
  }, [focusPriceRequest, selected])

  const selectAsset = (asset: InvestmentAsset) => {
    setSelected(asset)
    setPriceInput('')
    setSharesInput('')
  }

  const selectAllOnFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  const price = parseUserNumber(priceInput)
  const sharesParsed = parseUserNumber(sharesInput)
  const shares = sharesParsed != null && sharesParsed > 0 ? sharesParsed : null

  const analysis =
    selected && price != null && price > 0 ? analyzeTrade(selected, price, shares) : null

  const priceError =
    priceInput.trim() !== '' && (price == null || price <= 0)
      ? 'Enter a valid price greater than 0'
      : null

  return (
    <div className="stack">
      <section className="hero-banner">
        <h1><span aria-hidden="true">📈</span> Investments</h1>
        <p>
          Plug in the in-game <strong style={{ color: 'var(--text)' }}>current price</strong> (and
          optionally how many shares you hold). The app computes remaining upside to your tracked
          max and recommends <strong style={{ color: 'var(--text)' }}>BUY / HOLD / SELL</strong> —
          the same rules as your multi-year spreadsheet.
        </p>
        <div className="segmented" role="tablist" aria-label="Asset type">
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'stock'}
            className={kind === 'stock' ? 'active' : undefined}
            onClick={() => setKind('stock')}
          >
            <span aria-hidden="true">📊</span> Stocks ({stocks.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === 'crypto'}
            className={kind === 'crypto' ? 'active' : undefined}
            onClick={() => setKind('crypto')}
          >
            <span aria-hidden="true">₿</span> Crypto ({cryptos.length})
          </button>
        </div>
      </section>

      <div className="grid-2 invest-layout">
        <section className="card">
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              {kind === 'stock' ? 'Stocks' : 'Cryptocurrencies'}
            </h3>
            <span className="results-count spacer">
              {query.trim()
                ? `${matches.length}${matches.length >= 40 ? '+' : ''} shown`
                : `${kind === 'stock' ? stocks.length : cryptos.length} assets`}
            </span>
          </div>

          <div className="field" style={{ marginBottom: '0.85rem' }}>
            <label className="field-label" htmlFor="asset-search">
              Search asset
            </label>
            <input
              id="asset-search"
              className="input"
              type="search"
              autoComplete="off"
              placeholder={kind === 'stock' ? 'e.g. Tassla, Pineapple, MVIDIA…' : 'e.g. BTC, Solana…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={selectAllOnFocus}
            />
          </div>

          <div className="table-wrap">
            <table className="collections">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Min</th>
                  <th scope="col">Avg</th>
                  <th scope="col">Max</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((a) => {
                  const isSelected = selected?.kind === a.kind && selected.id === a.id
                  return (
                    <tr
                      key={`${a.kind}-${a.id}`}
                      className={isSelected ? 'selected' : undefined}
                      style={{
                        cursor: 'pointer',
                        outline:
                          focusedAsset === `${a.kind}-${a.id}`
                            ? '2px solid var(--accent)'
                            : undefined,
                        outlineOffset: '-2px',
                      }}
                      onClick={() => selectAsset(a)}
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
                          onFocus={() => setFocusedAsset(`${a.kind}-${a.id}`)}
                          onBlur={() => setFocusedAsset(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              selectAsset(a)
                              setFocusPriceRequest((request) => request + 1)
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            selectAsset(a)
                          }}
                        >
                          {a.name}
                        </button>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(a.min)}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(a.average)}</td>
                      <td style={{ color: 'var(--cta)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(a.max)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {matches.length === 0 && (
            <div className="empty-state">No assets match “{query}”.</div>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <h3 className="section-title" style={{ marginBottom: '0.35rem' }}>
              Trade helper
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {selected
                ? `Selected: ${selected.name}`
                : 'Pick an asset on the left, then enter the live in-game price.'}
            </p>

            <div className="stack" style={{ gap: '0.85rem' }}>
              <div className="field">
                <label className="field-label" htmlFor="current-price">
                  Current price <span className="req-badge">Required</span>
                </label>
                <input
                  id="current-price"
                  ref={priceInputRef}
                  className="input input-lg"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={!selected}
                  placeholder={selected ? `e.g. ${selected.lastNow}` : 'Select an asset first'}
                  value={priceInput}
                  onChange={(e) => setPriceInput(sanitizeDecimalInput(e.target.value))}
                  onFocus={selectAllOnFocus}
                />
                {priceError && <div className="field-error">{priceError}</div>}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="shares">
                  Number of shares <span className="opt-badge">Optional</span>
                </label>
                <input
                  id="shares"
                  className="input input-lg"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  disabled={!selected}
                  placeholder="Leave blank if you don’t hold any"
                  value={sharesInput}
                  onChange={(e) => setSharesInput(sanitizeDecimalInput(e.target.value))}
                  onFocus={selectAllOnFocus}
                />
                <div className="stat-hint" style={{ marginTop: '0.25rem' }}>
                  Enter shares only if you already own the asset — that switches SELL vs HOLD when
                  price is at or above average.
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            {analysis ? (
              <VerdictPanel asset={selected!} analysis={analysis} />
            ) : (
              <div className="empty-state">
                {selected
                  ? 'Enter a current price to see potential and BUY / HOLD / SELL.'
                  : 'Select an asset to get started.'}
              </div>
            )}
          </section>

          <section className="hint-box">
            <strong>How it works</strong>
            <ul className="mechanics-list" style={{ marginTop: '0.5rem' }}>
              <li>
                <strong>Potential</strong> = (Max − Price) / Price — remaining upside to your tracked
                max.
              </li>
              <li>
                Price <strong>below average</strong> → <strong>BUY</strong>
              </li>
              <li>
                Price <strong>at/above average</strong> + you hold shares → <strong>SELL</strong>
              </li>
              <li>
                Price <strong>at/above average</strong> + no shares → <strong>HOLD</strong> (wait)
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
