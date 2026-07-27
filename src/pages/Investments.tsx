import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { TradeDialog, formatShares } from '../components/TradeDialog'
import {
  analyzeTrade,
  assetsFor,
  cryptos,
  formatMoney,
  formatPct,
  parseUserNumber,
  searchAssets,
  stocks,
} from '../data/investments'
import {
  assetStorageKey,
  averageCostAfterBuy,
  averageCostAfterSell,
  formatCostBasis,
  getStoredEntry,
  loadInvestmentPrefs,
  resolveFirstPrice,
  resolveStoredAsset,
  saveInvestmentPrefs,
  upsertEntry,
  type StoredAssetEntry,
} from '../data/investmentStorage'
import {
  formatSignedMoney,
  getAssetRealized,
  loadRealizedPnl,
  recordRealizedSell,
  saveRealizedPnl,
  type RealizedPnlState,
} from '../data/realizedPnlStorage'
import type { InvestmentAsset, InvestmentKind, TradeAction, TradeAnalysis } from '../types'

interface OwnedRow {
  asset: InvestmentAsset
  /** Live current price when valid; 0 placeholder when mid-edit (see priceValid). */
  price: number
  /** False when Current price is empty/zero mid-edit — metrics show —; do not trade. */
  priceValid: boolean
  firstPrice: number
  shares: number
  /** True when metrics used a real live price + shares (not placeholders). */
  metricsReady: boolean
  totalInvestment: number
  gainLoss: number
  gainLossPct: number
  maxPotential: number
  potentialPct: number
  action: TradeAction
}

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
  onOpenTrade,
}: {
  asset: InvestmentAsset
  analysis: TradeAnalysis
  onOpenTrade?: () => void
}) {
  const meta = actionMeta(analysis.action)
  const potPositive = analysis.potentialPct >= 0
  const tradeable = Boolean(onOpenTrade)

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <button
        type="button"
        className={`verdict-banner ${meta.className}${tradeable ? ' verdict-banner-clickable' : ''}`}
        onClick={onOpenTrade}
        disabled={!tradeable}
        aria-label={`${meta.label} — open buy or sell dialog for ${asset.name}`}
      >
        <div className="verdict-kicker">{asset.name}</div>
        <div className="verdict-action">{meta.label}</div>
        <p className="verdict-hint">{meta.hint}</p>
        {tradeable && (
          <span className="verdict-trade-hint">
            Tap to open trade dialog (buy or sell shares)
          </span>
        )}
      </button>

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

function applyEntry(
  asset: InvestmentAsset | null,
  entries: Record<string, StoredAssetEntry>,
): { price: string; shares: string } {
  if (!asset) return { price: '', shares: '' }
  return getStoredEntry(entries, asset.kind, asset.id)
}

export function Investments() {
  const initial = useMemo(() => loadInvestmentPrefs(), [])

  const [kind, setKind] = useState<InvestmentKind>(initial.kind)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds)
  const [entries, setEntries] = useState(initial.entries)

  const [selected, setSelected] = useState<InvestmentAsset | null>(() =>
    resolveStoredAsset(initial.kind, initial.selectedIds[initial.kind]),
  )
  const [priceInput, setPriceInput] = useState(() => {
    const asset = resolveStoredAsset(initial.kind, initial.selectedIds[initial.kind])
    return applyEntry(asset, initial.entries).price
  })
  const [sharesInput, setSharesInput] = useState(() => {
    const asset = resolveStoredAsset(initial.kind, initial.selectedIds[initial.kind])
    return applyEntry(asset, initial.entries).shares
  })
  const [focusedAsset, setFocusedAsset] = useState<string | null>(null)
  const [focusPriceRequest, setFocusPriceRequest] = useState(0)
  const [tradePosition, setTradePosition] = useState<OwnedRow | null>(null)
  const [realizedPnl, setRealizedPnl] = useState<RealizedPnlState>(() => loadRealizedPnl())
  const priceInputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => searchAssets(kind, query).slice(0, 40), [kind, query])

  /**
   * Owned / register rows for the active Stocks/Crypto tab.
   * Keep a row while shares are held (or both fields still present mid-edit), even if
   * Current price is temporarily blank/zero. Do not invent a live price from cost basis
   * for gain math — incomplete rows show "—" until price and shares are both valid again.
   */
  const ownedRows = useMemo((): OwnedRow[] => {
    const list = assetsFor(kind)
    const rows: OwnedRow[] = []

    for (const asset of list) {
      const entry = entries[assetStorageKey(kind, asset.id)]
      if (!entry) continue

      const priceVal = parseUserNumber(entry.price)
      const sharesVal = parseUserNumber(entry.shares)
      const priceValid = priceVal != null && priceVal > 0
      const sharesHeld = sharesVal != null && sharesVal > 0
      const priceFieldSet = entry.price.trim() !== ''
      const sharesFieldSet = entry.shares.trim() !== ''

      const firstRaw = resolveFirstPrice(entry)
      const firstPriceVal = firstRaw ? parseUserNumber(firstRaw) : null

      // Holding shares always stays on the register. Price-only lookups stay out.
      // Both fields still present (incl. "0") after a basis exists keeps mid-edit zeros.
      const inRegister =
        sharesHeld ||
        (sharesFieldSet &&
          priceFieldSet &&
          firstPriceVal != null &&
          firstPriceVal > 0)
      if (!inRegister) continue

      const shares = sharesVal != null && sharesVal >= 0 ? sharesVal : 0
      const basis =
        firstPriceVal != null && firstPriceVal > 0
          ? firstPriceVal
          : priceValid
            ? priceVal!
            : 0
      if (!(basis > 0)) continue

      const metricsReady = priceValid && sharesHeld
      const livePrice = priceValid ? priceVal! : 0

      if (!metricsReady) {
        rows.push({
          asset,
          price: livePrice,
          priceValid,
          firstPrice: basis,
          shares,
          metricsReady: false,
          // Rank by cost basis capital so the row does not jump while editing price.
          totalInvestment: sharesHeld ? basis * shares : 0,
          gainLoss: 0,
          gainLossPct: 0,
          maxPotential: 0,
          potentialPct: 0,
          action: 'HOLD',
        })
        continue
      }

      const analysis = analyzeTrade(asset, livePrice, shares)
      // Mark-to-market value = live price × shares (unrealized portfolio value).
      const totalInvestment = livePrice * shares
      const gainLoss = (livePrice - basis) * shares
      const gainLossPct = ((livePrice - basis) / basis) * 100

      rows.push({
        asset,
        price: livePrice,
        priceValid: true,
        firstPrice: basis,
        shares,
        metricsReady: true,
        totalInvestment,
        gainLoss,
        gainLossPct,
        maxPotential: analysis.totalUpside ?? (asset.max - livePrice) * shares,
        potentialPct: analysis.potentialPct,
        action: analysis.action,
      })
    }

    // Highest mark-to-market value first.
    rows.sort((a, b) => b.totalInvestment - a.totalInvestment)
    return rows
  }, [kind, entries])

  // Persist UI meta + each asset as its own localStorage key.
  useEffect(() => {
    saveInvestmentPrefs({
      version: 2,
      kind,
      selectedIds,
      entries,
    })
  }, [kind, selectedIds, entries])

  // Session realized P&L (tab-scoped).
  useEffect(() => {
    saveRealizedPnl(realizedPnl)
  }, [realizedPnl])

  const sessionKindTotal = realizedPnl.byKind[kind]
  const sessionOtherKind: InvestmentKind = kind === 'stock' ? 'crypto' : 'stock'
  const sessionOtherTotal = realizedPnl.byKind[sessionOtherKind]
  const sessionAssetHits = useMemo(() => {
    return Object.entries(realizedPnl.byAsset)
      .filter(([key]) => key.startsWith(`${kind}:`))
      .map(([key, stats]) => ({ key, ...stats }))
      .sort((a, b) => Math.abs(b.realized) - Math.abs(a.realized))
  }, [realizedPnl, kind])

  useEffect(() => {
    if (focusPriceRequest > 0) {
      priceInputRef.current?.focus()
      setFocusPriceRequest(0)
    }
  }, [focusPriceRequest, selected])

  const switchKind = (next: InvestmentKind) => {
    if (next === kind) return
    setKind(next)
    setQuery('')
    const asset = resolveStoredAsset(next, selectedIds[next])
    setSelected(asset)
    const entry = applyEntry(asset, entries)
    setPriceInput(entry.price)
    setSharesInput(entry.shares)
  }

  const selectAsset = (asset: InvestmentAsset) => {
    setSelected(asset)
    setSelectedIds((prev) => ({ ...prev, [asset.kind]: asset.id }))
    const entry = getStoredEntry(entries, asset.kind, asset.id)
    setPriceInput(entry.price)
    setSharesInput(entry.shares)
  }

  const setPriceForSelected = (value: string) => {
    const next = sanitizeDecimalInput(value)
    setPriceInput(next)
    if (!selected) return
    // Keystrokes only — do not lock cost basis on partial digits.
    setEntries((prev) =>
      upsertEntry(prev, selected.kind, selected.id, next, sharesInput),
    )
  }

  /**
   * Persist a complete price on blur. Only backfill a missing cost basis when
   * shares are already held (legacy repair) — new positions get basis from BUY.
   */
  const commitPriceBasis = () => {
    if (!selected) return
    const priceNum = parseUserNumber(priceInput)
    if (priceNum == null || priceNum <= 0) return
    const sharesNum = parseUserNumber(sharesInput)
    const holding = sharesNum != null && sharesNum > 0
    setEntries((prev) =>
      upsertEntry(prev, selected.kind, selected.id, priceInput, sharesInput, {
        establishBasis: holding,
      }),
    )
  }

  /**
   * Edit last price from the trade dialog — same string as the main Current price
   * field, plus live metrics on the open dialog position.
   */
  const handleTradePriceChange = (value: string) => {
    if (!tradePosition) return
    const asset = tradePosition.asset
    const next = sanitizeDecimalInput(value)
    const entry = getStoredEntry(entries, asset.kind, asset.id)
    const sharesStr = entry.shares

    setSelected(asset)
    setSelectedIds((prev) => ({ ...prev, [asset.kind]: asset.id }))
    setPriceInput(next)
    setSharesInput(sharesStr)
    setEntries((prev) => upsertEntry(prev, asset.kind, asset.id, next, sharesStr))

    const priceVal = parseUserNumber(next)
    setTradePosition((prev) => {
      if (!prev) return null
      const held = prev.shares
      const basis = prev.firstPrice
      if (priceVal == null || priceVal <= 0) {
        return {
          ...prev,
          price: 0,
          priceValid: false,
          metricsReady: false,
          totalInvestment: held > 0 && basis > 0 ? basis * held : 0,
          gainLoss: 0,
          gainLossPct: 0,
          maxPotential: 0,
          potentialPct: 0,
          action: 'HOLD',
        }
      }
      const analysis = analyzeTrade(asset, priceVal, held > 0 ? held : null)
      return {
        ...prev,
        price: priceVal,
        priceValid: true,
        metricsReady: held > 0,
        totalInvestment: held > 0 ? priceVal * held : 0,
        gainLoss: held > 0 ? (priceVal - basis) * held : 0,
        gainLossPct:
          held > 0 && basis > 0 ? ((priceVal - basis) / basis) * 100 : 0,
        maxPotential: held > 0 ? (asset.max - priceVal) * held : 0,
        potentialPct: analysis.potentialPct,
        action: analysis.action,
      }
    })
  }

  /**
   * Apply a buy/sell to storage with explicit average-cost basis.
   * - Buy: weighted average of prior cost and this fill
   * - Partial sell: per-share basis unchanged
   * - Full exit: clear basis (next open starts fresh)
   */
  const applyShareDelta = (
    asset: InvestmentAsset,
    price: number,
    nextShares: number,
    costBasis: number | null,
  ) => {
    const priceStr = String(price)
    const sharesStr = nextShares > 1e-12 ? formatShares(nextShares) : ''
    const basisOpt =
      costBasis != null && costBasis > 0
        ? { costBasis: formatCostBasis(costBasis) }
        : { costBasis: null as string | null }
    setEntries((prev) =>
      upsertEntry(prev, asset.kind, asset.id, priceStr, sharesStr, basisOpt),
    )
    setSelectedIds((prev) => ({ ...prev, [asset.kind]: asset.id }))
    setSelected(asset)
    setPriceInput(priceStr)
    setSharesInput(sharesStr)
  }

  const handleTradeBuy = (sharesToBuy: number) => {
    if (!tradePosition || !(sharesToBuy > 0)) return
    const held = tradePosition.shares
    const buyPrice = tradePosition.price
    const next = held + sharesToBuy
    const newBasis = averageCostAfterBuy(
      held,
      tradePosition.firstPrice,
      sharesToBuy,
      buyPrice,
    )
    applyShareDelta(tradePosition.asset, buyPrice, next, newBasis)
    setTradePosition(null)
  }

  const handleTradeSell = (sharesToSell: number) => {
    if (!tradePosition || !(sharesToSell > 0)) return
    const sold = Math.min(sharesToSell, tradePosition.shares)
    if (!(sold > 0)) return

    const basisPerShare =
      tradePosition.firstPrice > 0 ? tradePosition.firstPrice : tradePosition.price

    setRealizedPnl((prev) =>
      recordRealizedSell(
        prev,
        tradePosition.asset.kind,
        tradePosition.asset.id,
        tradePosition.asset.name,
        tradePosition.price,
        basisPerShare,
        sold,
      ),
    )

    const next = Math.max(0, tradePosition.shares - sold)
    const remainingBasis = averageCostAfterSell(
      tradePosition.shares,
      basisPerShare,
      sold,
    )
    applyShareDelta(tradePosition.asset, tradePosition.price, next, remainingBasis)
    setTradePosition(null)
  }

  /** Build a trade dialog position from the live trade-helper selection. */
  const openTradeFromVerdict = () => {
    if (!selected) return
    const priceVal = parseUserNumber(priceInput)
    if (priceVal == null || priceVal <= 0) return

    const sharesVal = parseUserNumber(sharesInput)
    const held = sharesVal != null && sharesVal > 0 ? sharesVal : 0
    const entry = getStoredEntry(entries, selected.kind, selected.id)
    const firstRaw = resolveFirstPrice(entry)
    const firstParsed = firstRaw ? parseUserNumber(firstRaw) : null
    const firstPriceVal =
      firstParsed != null && firstParsed > 0 ? firstParsed : priceVal

    const live = analyzeTrade(selected, priceVal, held > 0 ? held : null)
    setTradePosition({
      asset: selected,
      price: priceVal,
      priceValid: true,
      firstPrice: firstPriceVal,
      shares: held,
      metricsReady: held > 0,
      totalInvestment: held > 0 ? priceVal * held : 0,
      gainLoss: held > 0 ? (priceVal - firstPriceVal) * held : 0,
      gainLossPct:
        held > 0 && firstPriceVal > 0
          ? ((priceVal - firstPriceVal) / firstPriceVal) * 100
          : 0,
      maxPotential: held > 0 ? (selected.max - priceVal) * held : 0,
      potentialPct: live.potentialPct,
      action: live.action,
    })
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
        <h1>
          <span aria-hidden="true">📈</span> Investments
        </h1>
        {/*
        <p>
          Plug in the in-game <strong style={{ color: 'var(--text)' }}>current price</strong> (and
          optionally how many shares you hold). The app computes remaining upside to your tracked
          max and recommends <strong style={{ color: 'var(--text)' }}>BUY / HOLD / SELL</strong> —
          the same rules as your multi-year spreadsheet.
        </p>
*/}
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
        </div>
      </section>

      <section className="card session-pnl" aria-label="Session realized gains and losses">
        <div className="row session-pnl-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            Session realized P&amp;L
          </h3>
          <span className="results-count spacer">sessionStorage · this tab</span>
        </div>
        <div className="session-pnl-buckets">
          <div className={`session-pnl-bucket ${kind === 'stock' ? 'active' : ''}`}>
            <span className="session-pnl-label">Stocks</span>
            <span
              className={`session-pnl-value ${
                realizedPnl.byKind.stock > 0
                  ? 'pot-up'
                  : realizedPnl.byKind.stock < 0
                    ? 'pot-down'
                    : ''
              }`}
            >
              {formatSignedMoney(realizedPnl.byKind.stock)}
            </span>
          </div>
          <div className={`session-pnl-bucket ${kind === 'crypto' ? 'active' : ''}`}>
            <span className="session-pnl-label">Crypto</span>
            <span
              className={`session-pnl-value ${
                realizedPnl.byKind.crypto > 0
                  ? 'pot-up'
                  : realizedPnl.byKind.crypto < 0
                    ? 'pot-down'
                    : ''
              }`}
            >
              {formatSignedMoney(realizedPnl.byKind.crypto)}
            </span>
          </div>
          <div className="session-pnl-bucket session-pnl-combined">
            <span className="session-pnl-label">Combined</span>
            <span
              className={`session-pnl-value ${
                realizedPnl.byKind.stock + realizedPnl.byKind.crypto > 0
                  ? 'pot-up'
                  : realizedPnl.byKind.stock + realizedPnl.byKind.crypto < 0
                    ? 'pot-down'
                    : ''
              }`}
            >
              {formatSignedMoney(realizedPnl.byKind.stock + realizedPnl.byKind.crypto)}
            </span>
          </div>
        </div>
        {sessionAssetHits.length > 0 && (
          <div className="session-pnl-assets">
            <div className="session-pnl-assets-label">
              {kind === 'stock' ? 'Stock' : 'Crypto'} tickers this session
              {sessionOtherTotal !== 0 && (
                <span className="session-pnl-other">
                  {' '}
                  · other book {formatSignedMoney(sessionOtherTotal)}
                </span>
              )}
            </div>
            <ul className="session-pnl-asset-list">
              {sessionAssetHits.map((a) => (
                <li key={a.key}>
                  <span className="session-pnl-asset-name">{a.name}</span>
                  <span
                    className={
                      a.realized > 0 ? 'pot-up' : a.realized < 0 ? 'pot-down' : undefined
                    }
                  >
                    {formatSignedMoney(a.realized)}
                  </span>
                  <span className="session-pnl-sells">
                    {a.sellCount} sell{a.sellCount === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {sessionAssetHits.length === 0 && sessionKindTotal === 0 && (
          <p className="session-pnl-empty">
            Realized gains and losses post when you <strong>SELL</strong> via the trade dialog.
            Totals reset when this browser tab closes.
          </p>
        )}
      </section>

      {ownedRows.length > 0 && (
        <section className="card owned-assets" aria-label="Owned assets">
          <div className="row owned-assets-header">
            <h3 className="section-title" style={{ margin: 0 }}>
              Owned {kind === 'stock' ? 'stocks' : 'crypto'}
            </h3>
            <span className="results-count spacer">{ownedRows.length}</span>
          </div>
          <div className="table-wrap owned-assets-wrap">
            <table className="collections owned-assets-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Last price</th>
                  <th scope="col">Total inv.</th>
                  <th scope="col">Unrealized</th>
                  <th scope="col">Realized</th>
                  <th scope="col">Max potential</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {ownedRows.map((row) => {
                  const isSelected =
                    selected?.kind === row.asset.kind && selected.id === row.asset.id
                  const actionClass =
                    row.action === 'BUY'
                      ? 'action-buy'
                      : row.action === 'SELL'
                        ? 'action-sell'
                        : 'action-hold'
                  const potPositive = row.maxPotential >= 0
                  const gainPositive = row.gainLoss > 0
                  const gainNegative = row.gainLoss < 0
                  const gainClass = row.metricsReady
                    ? gainPositive
                      ? 'pot-up'
                      : gainNegative
                        ? 'pot-down'
                        : undefined
                    : undefined
                  const realized =
                    getAssetRealized(realizedPnl, row.asset.kind, row.asset.id)?.realized ?? 0
                  const realizedClass =
                    realized > 0 ? 'pot-up' : realized < 0 ? 'pot-down' : undefined
                  const shareLabel =
                    row.shares > 0
                      ? `${row.shares.toLocaleString()} shares`
                      : 'shares zeroed — still on register'
                  return (
                    <tr
                      key={`${row.asset.kind}-${row.asset.id}`}
                      className={isSelected ? 'selected' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => selectAsset(row.asset)}
                      title={`${shareLabel} · cost basis ${formatMoney(row.firstPrice)} · click to edit`}
                    >
                      <td className="collection-name">{row.asset.name}</td>
                      <td className="num-cell">
                        {row.priceValid ? formatMoney(row.price) : '—'}
                      </td>
                      <td className="num-cell">
                        {row.metricsReady ? formatMoney(row.totalInvestment) : '—'}
                      </td>
                      <td className={`num-cell ${gainClass ?? ''}`.trim()}>
                        {row.metricsReady ? (
                          <>
                            {formatMoney(row.gainLoss)}{' '}
                            <span className="pot-pct">({formatPct(row.gainLossPct)})</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={`num-cell ${realizedClass ?? ''}`.trim()}>
                        {formatSignedMoney(realized)}
                      </td>
                      <td
                        className={`num-cell ${
                          row.metricsReady ? (potPositive ? 'pot-up' : 'pot-down') : ''
                        }`.trim()}
                      >
                        {row.metricsReady ? (
                          <>
                            {formatMoney(row.maxPotential)}{' '}
                            <span className="pot-pct">({formatPct(row.potentialPct)})</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`action-chip action-chip-btn ${actionClass}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!row.priceValid) return
                            // Select so main Current price field stays in sync with the dialog.
                            selectAsset(row.asset)
                            setTradePosition(row)
                          }}
                          disabled={!row.priceValid}
                          title={
                            row.priceValid
                              ? `Trade ${row.asset.name}`
                              : 'Enter a current price greater than 0 to trade'
                          }
                          aria-label={
                            row.priceValid
                              ? `Open buy or sell dialog for ${row.asset.name}, signal ${row.action}`
                              : `Cannot trade ${row.asset.name} without a current price`
                          }
                        >
                          {row.action}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tradePosition && (
        <TradeDialog
          position={tradePosition}
          priceText={priceInput}
          sessionRealized={
            getAssetRealized(realizedPnl, tradePosition.asset.kind, tradePosition.asset.id)
              ?.realized ?? 0
          }
          onClose={() => setTradePosition(null)}
          onBuy={handleTradeBuy}
          onSell={handleTradeSell}
          onPriceChange={handleTradePriceChange}
          onPriceBlur={commitPriceBasis}
        />
      )}

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
                  onChange={(e) => setPriceForSelected(e.target.value)}
                  onFocus={selectAllOnFocus}
                  onBlur={commitPriceBasis}
                />
                {priceError && <div className="field-error">{priceError}</div>}
              </div>

              {selected && (
                <div className="stat-card" style={{ margin: 0 }}>
                  <div className="stat-label">Shares held</div>
                  <div className="stat-value">
                    {shares != null ? shares.toLocaleString() : '0'}
                  </div>
                  <div className="stat-hint" style={{ marginTop: '0.35rem' }}>
                    {shares != null
                      ? 'Use BUY / SELL on the verdict (or the owned table) to change this position. Average cost updates automatically.'
                      : 'No position yet — enter a price, then tap BUY on the verdict to open shares via the trade dialog.'}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            {analysis ? (
              <VerdictPanel
                asset={selected!}
                analysis={analysis}
                onOpenTrade={openTradeFromVerdict}
              />
            ) : (
              <div className="empty-state">
                {selected
                  ? 'Enter a current price to see potential and open the BUY / SELL dialog.'
                  : 'Select an asset to get started.'}
              </div>
            )}
          </section>

          <section className="hint-box">
            <strong>How it works</strong>
            <ul className="mechanics-list" style={{ marginTop: '0.5rem' }}>
              <li>
                Enter the <strong>current price</strong>, then tap the verdict to{' '}
                <strong>BUY</strong> or <strong>SELL</strong> shares in the trade dialog.
              </li>
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
