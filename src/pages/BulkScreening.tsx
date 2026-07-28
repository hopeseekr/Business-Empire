import { useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { unitWord } from '../components/TradeDialog'
import {
  assetsFor,
  bullion,
  cryptos,
  formatMoney,
  formatPct,
  parseUserNumber,
  potentialPct,
  recommendAction,
  sanitizeDecimalInput,
  stocks,
} from '../data/investments'
import {
  getStoredEntry,
  loadInvestmentPrefs,
  saveInvestmentPrefs,
  upsertEntry,
  type StoredAssetEntry,
} from '../data/investmentStorage'
import type { InvestmentAsset, InvestmentKind, TradeAction } from '../types'

/** One screened asset: reference band + whatever the user has typed so far. */
interface ScreenRow {
  asset: InvestmentAsset
  /** Raw text in the price box (may be mid-edit, e.g. "12."). */
  priceText: string
  /** Parsed price when > 0, else null (metrics show —). */
  price: number | null
  shares: number
  /** (Price − Avg) / Avg × 100 — negative means trading at a discount. */
  vsAvgPct: number | null
  /** (Max − Price) / Price × 100 — remaining upside to the tracked max. */
  toMaxPct: number | null
  action: TradeAction | null
}

/** Yield column sort: market order → highest first → lowest first → market order. */
type YieldSort = 'none' | 'desc' | 'asc'

const NEXT_YIELD_SORT: Record<YieldSort, YieldSort> = {
  none: 'desc',
  desc: 'asc',
  asc: 'none',
}

const YIELD_SORT_HINT: Record<YieldSort, string> = {
  none: 'Sort by yield, highest first',
  desc: 'Sort by yield, lowest first',
  asc: 'Clear yield sort (back to market order)',
}

/** Plain percentage — yield is a rate, so it never gets formatPct's leading "+". */
function formatYield(pct: number): string {
  return `${pct.toFixed(2)}%`
}

function kindLabel(kind: InvestmentKind): string {
  if (kind === 'stock') return 'stocks'
  if (kind === 'crypto') return 'cryptocurrencies'
  return 'bullion'
}

function actionClass(action: TradeAction): string {
  if (action === 'BUY') return 'action-buy'
  if (action === 'SELL') return 'action-sell'
  return 'action-hold'
}

/** Discount to average is the buy signal, so below-average reads green. */
function vsAvgClass(pct: number): string {
  if (pct < 0) return 'pot-up'
  if (pct > 0) return 'pot-down'
  return ''
}

export function BulkScreening() {
  const initial = useMemo(() => loadInvestmentPrefs(), [])

  const [kind, setKind] = useState<InvestmentKind>(initial.kind)
  const [selectedIds] = useState(initial.selectedIds)
  const [entries, setEntries] = useState(initial.entries)
  // Stocks open with the highest-yielding assets first.
  const [yieldSort, setYieldSort] = useState<YieldSort>('desc')

  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  /** Only stocks carry a yield today; the column hides itself for other markets. */
  const showYield = useMemo(() => assetsFor(kind).some((a) => a.yieldPct != null), [kind])

  const rows = useMemo((): ScreenRow[] => {
    const built = assetsFor(kind).map((asset) => {
      const entry = getStoredEntry(entries, kind, asset.id)
      const parsed = parseUserNumber(entry.price)
      const price = parsed != null && parsed > 0 ? parsed : null
      const sharesParsed = parseUserNumber(entry.shares)
      const shares = sharesParsed != null && sharesParsed > 0 ? sharesParsed : 0

      return {
        asset,
        priceText: entry.price,
        price,
        shares,
        vsAvgPct:
          price != null && asset.average > 0
            ? ((price - asset.average) / asset.average) * 100
            : null,
        toMaxPct: price != null ? potentialPct(asset.max, price) : null,
        action: price != null ? recommendAction(price, asset.average, shares > 0) : null,
      }
    })

    // Yield is static data, so sorting by it never reshuffles rows mid-typing.
    // Sort is stable, so equal yields keep market order; missing yields sink last.
    if (!showYield || yieldSort === 'none') return built

    const direction = yieldSort === 'asc' ? 1 : -1
    return [...built].sort((a, b) => {
      const av = a.asset.yieldPct
      const bv = b.asset.yieldPct
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return (av - bv) * direction
    })
  }, [kind, entries, showYield, yieldSort])

  const priced = rows.filter((row) => row.price != null)
  const buys = priced.filter((row) => row.action === 'BUY')
  const sells = priced.filter((row) => row.action === 'SELL')
  const holds = priced.filter((row) => row.action === 'HOLD')

  /** Best entries first: cheapest against average, then most room to max. */
  const opportunities = useMemo(() => {
    return [...buys]
      .sort((a, b) => (b.toMaxPct ?? 0) - (a.toMaxPct ?? 0))
      .slice(0, 5)
  }, [buys])

  // Debounced persist — bulk entry touches every asset key, so don't write on
  // each keystroke. The unmount flush below covers navigating away mid-typing.
  const latestPrefs = useRef({ kind, selectedIds, entries })
  latestPrefs.current = { kind, selectedIds, entries }

  useEffect(() => {
    const timer = setTimeout(() => {
      saveInvestmentPrefs({ version: 2, kind, selectedIds, entries })
    }, 250)
    return () => clearTimeout(timer)
  }, [kind, selectedIds, entries])

  useEffect(() => {
    return () => {
      const { kind: k, selectedIds: ids, entries: e } = latestPrefs.current
      saveInvestmentPrefs({ version: 2, kind: k, selectedIds: ids, entries: e })
    }
  }, [])

  const switchKind = (next: InvestmentKind) => {
    if (next === kind) return
    inputsRef.current = []
    setKind(next)
  }

  const setPrice = (asset: InvestmentAsset, value: string) => {
    const next = sanitizeDecimalInput(value)
    setEntries((prev) => {
      const entry = getStoredEntry(prev, asset.kind, asset.id)
      return upsertEntry(prev, asset.kind, asset.id, next, entry.shares)
    })
  }

  /**
   * Lock cost basis on blur only when the asset is actually held — matches the
   * Trade helper. Screening a price you don't own must never invent a basis.
   */
  const commitPrice = (asset: InvestmentAsset) => {
    setEntries((prev) => {
      const entry: StoredAssetEntry = getStoredEntry(prev, asset.kind, asset.id)
      const priceNum = parseUserNumber(entry.price)
      if (priceNum == null || priceNum <= 0) return prev
      const sharesNum = parseUserNumber(entry.shares)
      const holding = sharesNum != null && sharesNum > 0
      return upsertEntry(prev, asset.kind, asset.id, entry.price, entry.shares, {
        establishBasis: holding,
      })
    })
  }

  const focusInput = (index: number) => {
    const count = rows.length
    if (count === 0) return
    const wrapped = ((index % count) + count) % count
    const el = inputsRef.current[wrapped]
    el?.focus()
    el?.select()
  }

  /** ENTER / arrows walk the column; TAB already moves natively (inputs are the only stops). */
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number, asset: InvestmentAsset) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitPrice(asset)
      focusInput(e.shiftKey ? index - 1 : index + 1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusInput(index + 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusInput(index - 1)
      return
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  const selectAllOnFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  /** Wipe screened prices for this market; positions (shares + cost basis) survive. */
  const clearPrices = () => {
    if (priced.length === 0) return
    const ok = window.confirm(
      `Clear the ${priced.length} entered price${priced.length === 1 ? '' : 's'} for ${kindLabel(kind)}? Your holdings and cost basis are kept.`,
    )
    if (!ok) return

    setEntries((prev) => {
      let next = prev
      for (const asset of assetsFor(kind)) {
        const entry = getStoredEntry(next, kind, asset.id)
        if (!entry.price.trim()) continue
        next = upsertEntry(next, kind, asset.id, '', entry.shares)
      }
      return next
    })
    focusInput(0)
  }

  return (
    <div className="stack">
      <section className="hero-banner">
        <h1>
          <span aria-hidden="true">⚡</span> Bulk Screening
        </h1>
        <p>
          Type the live in-game price for every ticker in one pass — press{' '}
          <strong style={{ color: 'var(--text)' }}>ENTER</strong> or{' '}
          <strong style={{ color: 'var(--text)' }}>TAB</strong> to jump to the next box. Each row
          scores itself against its average and max the moment you type, so the growth plays fall
          out of the list. Prices are shared with the Trade helper.
        </p>
        <div className="row">
          <div className="segmented" role="tablist" aria-label="Asset type">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'stock'}
              className={kind === 'stock' ? 'active' : undefined}
              onClick={() => switchKind('stock')}
            >
              <span aria-hidden="true">📊</span> Stocks ({stocks.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'crypto'}
              className={kind === 'crypto' ? 'active' : undefined}
              onClick={() => switchKind('crypto')}
            >
              <span aria-hidden="true">₿</span> Crypto ({cryptos.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'bullion'}
              className={kind === 'bullion' ? 'active' : undefined}
              onClick={() => switchKind('bullion')}
            >
              <span aria-hidden="true">🥇</span> Bullion ({bullion.length})
            </button>
          </div>
          <Link to="/investments" className="btn btn-ghost btn-sm" title="Investments">
            <span aria-hidden="true">📈</span> Investments
          </Link>
        </div>
      </section>

      <section className="card screening-summary" aria-label="Screening progress">
        <div className="screening-progress">
          <div className="row">
            <span className="screening-progress-label">
              {priced.length} / {rows.length} priced
            </span>
            <span className="results-count spacer">{kindLabel(kind)}</span>
          </div>
          <div className="screening-progress-track" aria-hidden>
            <div
              className="screening-progress-fill"
              style={{ width: `${rows.length ? (priced.length / rows.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="screening-tallies">
          <div className="screening-tally action-buy">
            <span className="screening-tally-value">{buys.length}</span>
            <span className="screening-tally-label">Buy</span>
          </div>
          <div className="screening-tally action-hold">
            <span className="screening-tally-value">{holds.length}</span>
            <span className="screening-tally-label">Hold</span>
          </div>
          <div className="screening-tally action-sell">
            <span className="screening-tally-value">{sells.length}</span>
            <span className="screening-tally-label">Sell</span>
          </div>
        </div>

        <div className="screening-summary-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={clearPrices}
            disabled={priced.length === 0}
            title="Clear entered prices for this market (holdings and cost basis are kept)"
          >
            Clear prices
          </button>
        </div>
      </section>

      {opportunities.length > 0 && (
        <section className="card screening-opportunities" aria-label="Top growth opportunities">
          <div className="row" style={{ marginBottom: '0.5rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Top growth opportunities
            </h3>
            <span className="results-count spacer">
              below average · ranked by upside to max
            </span>
          </div>
          <ol className="screening-opportunity-list">
            {opportunities.map((row) => (
              <li key={`${row.asset.kind}-${row.asset.id}`}>
                <span className="screening-opportunity-name">{row.asset.name}</span>
                <span className="screening-opportunity-price">{formatMoney(row.price!)}</span>
                <span className={vsAvgClass(row.vsAvgPct!)}>
                  {formatPct(row.vsAvgPct!)} vs avg
                </span>
                <span className="pot-up">{formatPct(row.toMaxPct!)} to max</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card screening-card" aria-label="Bulk price entry">
        <div className="row screening-table-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            Enter prices
          </h3>
          <span className="results-count spacer">
            ENTER / TAB → next · SHIFT+ENTER → previous · ↑ ↓ to move
          </span>
        </div>

        <div className="table-wrap screening-wrap">
          <table className="collections screening-table">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Min</th>
                <th scope="col">Avg</th>
                <th scope="col">Max</th>
                {showYield && (
                  <th
                    scope="col"
                    aria-sort={
                      yieldSort === 'asc'
                        ? 'ascending'
                        : yieldSort === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                  >
                    <button
                      type="button"
                      className={`screening-sort-btn${yieldSort === 'none' ? '' : ' active'}`}
                      onClick={() => setYieldSort(NEXT_YIELD_SORT[yieldSort])}
                      title={YIELD_SORT_HINT[yieldSort]}
                      aria-label={YIELD_SORT_HINT[yieldSort]}
                    >
                      Yield
                      <span className="screening-sort-arrow" aria-hidden="true">
                        {yieldSort === 'desc' ? '▼' : yieldSort === 'asc' ? '▲' : '↕'}
                      </span>
                    </button>
                  </th>
                )}
                <th scope="col" className="screening-input-col">
                  Current price
                </th>
                <th scope="col" title="(Price − Average) / Average">
                  vs Avg
                </th>
                <th scope="col" title="(Max − Price) / Price — remaining upside">
                  To Max
                </th>
                <th scope="col">Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const { asset } = row
                const held = row.shares > 0
                return (
                  <tr
                    key={`${asset.kind}-${asset.id}`}
                    className={`${row.action ? `screening-row ${actionClass(row.action)}` : 'screening-row'}`}
                  >
                    <td className="collection-name">
                      {asset.name}
                      {held && (
                        <span
                          className="screening-held"
                          title={`You hold ${row.shares.toLocaleString()} ${unitWord(asset, 'plural')}`}
                        >
                          {row.shares.toLocaleString()} {unitWord(asset, 'plural')}
                        </span>
                      )}
                    </td>
                    <td className="num-cell screening-muted">{formatMoney(asset.min)}</td>
                    <td className="num-cell">{formatMoney(asset.average)}</td>
                    <td className="num-cell screening-max">{formatMoney(asset.max)}</td>
                    {showYield && (
                      <td className="num-cell screening-yield">
                        {asset.yieldPct != null ? formatYield(asset.yieldPct) : '—'}
                      </td>
                    )}
                    <td className="screening-input-col">
                      <input
                        ref={(el) => {
                          inputsRef.current[index] = el
                        }}
                        className="input screening-input"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Current price for ${asset.name}`}
                        placeholder={String(asset.lastNow)}
                        value={row.priceText}
                        onChange={(e) => setPrice(asset, e.target.value)}
                        onFocus={selectAllOnFocus}
                        onBlur={() => commitPrice(asset)}
                        onKeyDown={(e) => handleKeyDown(e, index, asset)}
                      />
                    </td>
                    <td
                      className={`num-cell ${row.vsAvgPct != null ? vsAvgClass(row.vsAvgPct) : ''}`.trim()}
                    >
                      {row.vsAvgPct != null ? formatPct(row.vsAvgPct) : '—'}
                    </td>
                    <td
                      className={`num-cell ${
                        row.toMaxPct != null ? (row.toMaxPct > 0 ? 'pot-up' : 'pot-down') : ''
                      }`.trim()}
                    >
                      {row.toMaxPct != null ? formatPct(row.toMaxPct) : '—'}
                    </td>
                    <td>
                      {row.action ? (
                        <span className={`action-chip ${actionClass(row.action)}`}>
                          {row.action}
                        </span>
                      ) : (
                        <span className="screening-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hint-box">
        <strong>How to screen fast</strong>
        <ul className="mechanics-list" style={{ marginTop: '0.5rem' }}>
          <li>
            Work top to bottom: type a price, hit <strong>ENTER</strong> (or <strong>TAB</strong>),
            repeat. The list order matches the in-game market list.
          </li>
          <li>
            <strong>vs Avg</strong> = (Price − Average) / Average. Negative (green) means the ticker
            is on discount — that is the <strong>BUY</strong> trigger.
          </li>
          <li>
            <strong>To Max</strong> = (Max − Price) / Price — the growth still on the table if it
            runs back to its tracked max.
          </li>
          <li>
            <strong>SELL</strong> only shows for tickers you already hold; otherwise an
            at/above-average price reads <strong>HOLD</strong>.
          </li>
          <li>
            Click the <strong>Yield</strong> header to sort highest-first, again for
            lowest-first, and a third time to return to market order. Yield is fixed data, so
            sorting never reshuffles rows while you are typing.
          </li>
          <li>
            Prices you enter here are the same ones the <strong>Trade helper</strong> uses — screen
            the market, then jump there to execute a trade.
          </li>
        </ul>
      </section>
    </div>
  )
}
