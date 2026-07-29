import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FocusEvent } from 'react'
import { Link } from 'react-router-dom'
import { TradeDialog, unitWord } from '../components/TradeDialog'
import { NftDialog } from '../components/NftDialog'
import { loadOwnedNfts, nfts, saveOwnedNfts, type NftCurrency, type OwnedNfts } from '../data/nfts'
import {
  analyzeTrade,
  assetsFor,
  bullion,
  cryptos,
  formatMoney,
  formatPct,
  parseUserNumber,
  sanitizeDecimalInput,
  searchAssets,
  stocks,
} from '../data/investments'
import {
  assetStorageKey,
  getStoredEntry,
  loadInvestmentPrefs,
  resolveFirstPrice,
  resolveStoredAsset,
  saveInvestmentPrefs,
  upsertEntry,
  type InvestmentPrefs,
  type StoredAssetEntry,
} from '../data/investmentStorage'
import { addFixed8, formatFixed8, parseFixed8, subtractFixed8, weightedAverageCost } from '../data/fixedPoint'
import {
  downloadPortfolioBackup,
  parsePortfolioBackup,
  readBackupFile,
  type ImportResult,
} from '../data/portfolioBackup'
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
  priceText: string
  sharesText: string
  firstPriceText: string
}

function kindTitle(kind: InvestmentKind): string {
  if (kind === 'stock') return 'Stocks'
  if (kind === 'crypto') return 'Cryptocurrencies'
  return 'Bullion'
}

function kindShort(kind: InvestmentKind): string {
  if (kind === 'stock') return 'Stock'
  if (kind === 'crypto') return 'Crypto'
  return 'Bullion'
}

function kindOwnedLabel(kind: InvestmentKind): string {
  if (kind === 'stock') return 'stocks'
  if (kind === 'crypto') return 'crypto'
  return 'bullion'
}

function assetsCount(kind: InvestmentKind): number {
  return assetsFor(kind).length
}

function actionMeta(
  action: TradeAction,
  unitSource: InvestmentAsset | InvestmentKind,
): { label: string; hint: string; className: string } {
  const units = unitWord(unitSource, 'plural')
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
        hint: `You hold ${units} and price is at/above average — take profit toward max.`,
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

function VerdictPanel({
  asset,
  analysis,
  onOpenTrade,
}: {
  asset: InvestmentAsset
  analysis: TradeAnalysis
  onOpenTrade?: () => void
}) {
  const meta = actionMeta(analysis.action, asset)
  const potPositive = analysis.potentialPct >= 0
  const tradeable = Boolean(onOpenTrade)
  const units = unitWord(asset, 'plural')
  const unitsTitle = unitWord(asset, 'title')
  const unitSingular = unitWord(asset, 'singular')

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
            Tap to open trade dialog (buy or sell {units})
          </span>
        )}
      </button>

      <div className="potential-hero">
        <div className="potential-label">Potential remaining</div>
        <div className={`potential-value ${potPositive ? 'up' : 'down'}`}>
          {formatPct(analysis.potentialPct)}
        </div>
        <div className="potential-sub">
          Upside to max: <strong>{formatMoney(analysis.upsidePerShare)}</strong> / {unitSingular}
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
            <div className="stat-label">{unitsTitle}</div>
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
  const [ownedNfts, setOwnedNfts] = useState<OwnedNfts>(() => loadOwnedNfts())
  const [nftDialog, setNftDialog] = useState<NftCurrency | null>(null)
  const [nftExpanded, setNftExpanded] = useState<Partial<Record<NftCurrency, boolean>>>({})
  const [realizedPnl, setRealizedPnl] = useState<RealizedPnlState>(() => loadRealizedPnl())
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const priceInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const importTextareaRef = useRef<HTMLTextAreaElement>(null)

  const matches = useMemo(() => searchAssets(kind, query), [kind, query])

  const nftCost = (currency: NftCurrency) =>
    ownedNfts[currency].reduce(
      (sum, name) => sum + (nfts[currency].find((n) => n.name === name)?.price ?? 0),
      0,
    )

  /**
   * Owned / register rows for the active Stocks / Crypto / Bullion tab.
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
          priceText: entry.price,
          sharesText: entry.shares,
          firstPriceText: firstRaw ?? entry.price,
        })
        continue
      }

      const analysis = analyzeTrade(asset, livePrice, shares)
      // Mark-to-market value = live price × shares (unrealized portfolio value).
      const totalInvestment = livePrice * shares - (kind === 'crypto' && asset.name.toUpperCase() === 'ETH' ? nftCost('ETH') : kind === 'crypto' && asset.name.toUpperCase() === 'TRB' ? nftCost('TRB') : 0)
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
        priceText: entry.price,
        sharesText: entry.shares,
        firstPriceText: firstRaw ?? entry.price,
      })
    }

    // Highest mark-to-market value first.
    rows.sort((a, b) => b.totalInvestment - a.totalInvestment)
    return rows
  }, [kind, entries, ownedNfts])

  // Persist UI meta + each asset as its own localStorage key.
  useEffect(() => {
    saveInvestmentPrefs({
      version: 2,
      kind,
      selectedIds,
      entries,
    })
  }, [kind, selectedIds, entries])
  useEffect(() => { saveOwnedNfts(ownedNfts) }, [ownedNfts])

  // Realized P&L (localStorage — persists across tabs/restarts).
  useEffect(() => {
    saveRealizedPnl(realizedPnl)
  }, [realizedPnl])

  const sessionKindTotal = Number(realizedPnl.byKind[kind])
  const sessionCombinedTotal =
    Number(realizedPnl.byKind.stock) + Number(realizedPnl.byKind.crypto) + Number(realizedPnl.byKind.bullion)
  const sessionOtherTotal = sessionCombinedTotal - sessionKindTotal
  const sessionAssetHits = useMemo(() => {
    return Object.entries(realizedPnl.byAsset)
      .filter(([key]) => key.startsWith(`${kind}:`))
      .map(([key, stats]) => ({ key, ...stats }))
      .sort((a, b) => Math.abs(Number(b.realized)) - Math.abs(Number(a.realized)))
  }, [realizedPnl, kind])

  const buyNft = (currency: NftCurrency, names: string[]) => {
    setOwnedNfts((prev) => ({ ...prev, [currency]: [...prev[currency], ...names.filter((name) => !prev[currency].includes(name))] }))
    setNftDialog(null)
  }

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
    price: string,
    nextShares: string,
    costBasis: string | null,
  ) => {
    const priceStr = price
    const sharesUnits = parseFixed8(nextShares)
    const sharesStr = sharesUnits != null && sharesUnits > 0n ? formatFixed8(sharesUnits) : ''
    const basisOpt =
      costBasis != null && parseFixed8(costBasis)! > 0n
        ? { costBasis }
        : { costBasis: null as string | null }
    setEntries((prev) =>
      upsertEntry(prev, asset.kind, asset.id, priceStr, sharesStr, basisOpt),
    )
    setSelectedIds((prev) => ({ ...prev, [asset.kind]: asset.id }))
    setSelected(asset)
    setPriceInput(priceStr)
    setSharesInput(sharesStr)
  }

  const handleTradeBuy = (sharesToBuy: string) => {
    if (!tradePosition || parseFixed8(sharesToBuy) == null || parseFixed8(sharesToBuy)! <= 0n) return
    const held = tradePosition.sharesText
    const buyPrice = priceInput
    const next = addFixed8(held, sharesToBuy)
    const newBasis = weightedAverageCost(held, tradePosition.firstPriceText, sharesToBuy, buyPrice)
    if (!next || !newBasis) return
    applyShareDelta(tradePosition.asset, buyPrice, next, newBasis)
    setTradePosition(null)
  }

  const handleTradeSell = (sharesToSell: string) => {
    if (!tradePosition || parseFixed8(sharesToSell) == null || parseFixed8(sharesToSell)! <= 0n) return
    const soldUnits = parseFixed8(sharesToSell)!
    const heldUnits = parseFixed8(tradePosition.sharesText)
    if (heldUnits == null || soldUnits > heldUnits) return
    const sold = formatFixed8(soldUnits)
    const basisPerShare = tradePosition.firstPriceText

    setRealizedPnl((prev) =>
      recordRealizedSell(
        prev,
        tradePosition.asset.kind,
        tradePosition.asset.id,
        tradePosition.asset.name,
        priceInput,
        basisPerShare,
        sold,
      ),
    )

    const next = subtractFixed8(tradePosition.sharesText, sold)
    if (!next) return
    const remainingBasis = soldUnits === heldUnits ? null : basisPerShare
    applyShareDelta(tradePosition.asset, priceInput, next, remainingBasis)
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
      priceText: priceInput,
      sharesText: sharesInput,
      firstPriceText: firstRaw ?? priceInput,
    })
  }

  const selectAllOnFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  const applyImportedPrefs = (prefs: InvestmentPrefs) => {
    setKind(prefs.kind)
    setSelectedIds(prefs.selectedIds)
    setEntries(prefs.entries)
    const nextSelected = resolveStoredAsset(prefs.kind, prefs.selectedIds[prefs.kind])
    setSelected(nextSelected)
    const fields = applyEntry(nextSelected, prefs.entries)
    setPriceInput(fields.price)
    setSharesInput(fields.shares)
    setQuery('')
    setTradePosition(null)
    setFocusedAsset(null)
    saveInvestmentPrefs(prefs)
  }

  const handleExport = () => {
    downloadPortfolioBackup(
      {
        version: 2,
        kind,
        selectedIds,
        entries,
      },
      realizedPnl,
    )
  }

  const applyImportResult = (result: ImportResult): boolean => {
    if (!result.ok) {
      setBackupStatus(`Import failed: ${result.error}`)
      return false
    }

    if (result.mode === 'full') {
      const ok = window.confirm(
        'Import will replace your current portfolio data (positions, selections, and realized P&L). Continue?',
      )
      if (!ok) {
        setBackupStatus('Import cancelled.')
        return false
      }
      applyImportedPrefs(result.investments)
      setRealizedPnl(result.realizedPnl)
      saveRealizedPnl(result.realizedPnl)
      const n = Object.keys(result.investments.entries).length
      setBackupStatus(`Imported full backup (${n} position${n === 1 ? '' : 's'} + realized P&L).`)
      setImportOpen(false)
      setImportText('')
      return true
    }

    const ok = window.confirm(
      'Import will replace your current realized P&L totals (positions unchanged). Continue?',
    )
    if (!ok) {
      setBackupStatus('Import cancelled.')
      return false
    }
    setRealizedPnl(result.realizedPnl)
    saveRealizedPnl(result.realizedPnl)
    const tickers = Object.keys(result.realizedPnl.byAsset).length
    setBackupStatus(
      `Imported realized P&L only (${tickers} ticker${tickers === 1 ? '' : 's'}).`,
    )
    setImportOpen(false)
    setImportText('')
    return true
  }

  const handleImportToggle = () => {
    setImportOpen((open) => {
      const next = !open
      if (next) {
        // Focus paste field after panel mounts.
        queueMicrotask(() => importTextareaRef.current?.focus())
      }
      return next
    })
    setBackupStatus(null)
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Allow re-importing the same file later.
    e.target.value = ''
    if (!file) return

    const result = await readBackupFile(file)
    applyImportResult(result)
  }

  const handleImportPaste = () => {
    const trimmed = importText.trim()
    if (!trimmed) {
      setBackupStatus('Import failed: paste JSON first (full backup or realized P&L).')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed) as unknown
    } catch {
      setBackupStatus('Import failed: pasted text is not valid JSON.')
      return
    }
    applyImportResult(parsePortfolioBackup(parsed))
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
          <Link to="/investments/screening" className="btn btn-ghost btn-sm" title="Bulk Screening">
            <span aria-hidden="true">⚡</span> Bulk Screener
          </Link>
        </div>
      </section>

      <section className="card session-pnl" aria-label="Realized gains and losses">
        <div className="row session-pnl-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            Realized P&amp;L
          </h3>
          <div className="session-pnl-toolbar spacer">
            <span className="results-count">localStorage · persists</span>
            <div className="session-pnl-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleExport}
                title="Download positions + realized P&L as JSON"
              >
                Export
              </button>
              <button
                type="button"
                className={`btn btn-ghost btn-sm${importOpen ? ' active' : ''}`}
                onClick={handleImportToggle}
                aria-expanded={importOpen}
                title="Paste realized P&L JSON or choose a backup file"
              >
                Import
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json,text/plain"
                className="visually-hidden"
                aria-label="Import portfolio backup JSON file"
                onChange={handleImportFile}
              />
            </div>
          </div>
        </div>
        {importOpen && (
          <div className="session-pnl-import" aria-label="Import portfolio or realized P&L">
            <p className="session-pnl-import-hint">
              Paste a full Export backup, or bare realized P&L JSON
              (<code>version</code> / <code>byKind</code> / <code>byAsset</code>).
            </p>
            <textarea
              ref={importTextareaRef}
              className="input session-pnl-import-text"
              rows={8}
              spellCheck={false}
              placeholder='{"version":1,"byKind":{...},"byAsset":{...}}'
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="session-pnl-import-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={handleImportPaste}>
                Apply paste
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => importInputRef.current?.click()}
              >
                Choose file…
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setImportOpen(false)
                  setImportText('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {backupStatus && (
          <p className="session-pnl-backup-status" role="status">
            {backupStatus}
          </p>
        )}
        <div className="session-pnl-buckets">
          <div className={`session-pnl-bucket ${kind === 'stock' ? 'active' : ''}`}>
            <span className="session-pnl-label">Stocks</span>
            <span
              className={`session-pnl-value ${
                Number(realizedPnl.byKind.stock) > 0
                  ? 'pot-up'
                  : Number(realizedPnl.byKind.stock) < 0
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
                Number(realizedPnl.byKind.crypto) > 0
                  ? 'pot-up'
                  : Number(realizedPnl.byKind.crypto) < 0
                    ? 'pot-down'
                    : ''
              }`}
            >
              {formatSignedMoney(realizedPnl.byKind.crypto)}
            </span>
          </div>
          <div className={`session-pnl-bucket ${kind === 'bullion' ? 'active' : ''}`}>
            <span className="session-pnl-label">Bullion</span>
            <span
              className={`session-pnl-value ${
                Number(realizedPnl.byKind.bullion) > 0
                  ? 'pot-up'
                  : Number(realizedPnl.byKind.bullion) < 0
                    ? 'pot-down'
                    : ''
              }`}
            >
              {formatSignedMoney(realizedPnl.byKind.bullion)}
            </span>
          </div>
          <div className="session-pnl-bucket session-pnl-combined">
            <span className="session-pnl-label">Combined</span>
            <span
              className={`session-pnl-value ${
                sessionCombinedTotal > 0
                  ? 'pot-up'
                  : sessionCombinedTotal < 0
                    ? 'pot-down'
                    : ''
              }`}
            >
              {formatSignedMoney(sessionCombinedTotal)}
            </span>
          </div>
        </div>
        {sessionAssetHits.length > 0 && (
          <div className="session-pnl-assets">
            <div className="session-pnl-assets-label">
              {kindShort(kind)} tickers with sells
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
                      Number(a.realized) > 0 ? 'pot-up' : Number(a.realized) < 0 ? 'pot-down' : undefined
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
            Totals persist in localStorage across tabs and browser restarts.
          </p>
        )}
      </section>

      {ownedRows.length > 0 && (
        <section className="card owned-assets" aria-label="Owned assets">
          <div className="row owned-assets-header">
            <h3 className="section-title" style={{ margin: 0 }}>
              Owned {kindOwnedLabel(kind)}
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
                </tr>
              </thead>
              <tbody>
                {ownedRows.map((row) => {
                  const isSelected =
                    selected?.kind === row.asset.kind && selected.id === row.asset.id
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
                    Number(realized) > 0 ? 'pot-up' : Number(realized) < 0 ? 'pot-down' : undefined
                  const units = unitWord(row.asset, 'plural')
                  const shareLabel =
                    row.shares > 0
                      ? `${row.shares.toLocaleString()} ${units}`
                      : `${units} zeroed — still on register`
                  return (
                    <tr
                      key={`${row.asset.kind}-${row.asset.id}`}
                      className={isSelected ? 'selected' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => selectAsset(row.asset)}
                      title={`${shareLabel} · cost basis ${formatMoney(row.firstPrice)} · click to edit`}
                    >
                      <td className="collection-name">
                        {row.asset.name}
                        {kind === 'crypto' && (row.asset.name.toUpperCase() === 'ETH' || row.asset.name.toUpperCase() === 'TRB') && (() => {
                          const currency = row.asset.name.toUpperCase() as NftCurrency
                          const isOpen = !!nftExpanded[currency]
                          return (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm nft-inline-btn"
                              aria-expanded={isOpen}
                              aria-controls={`nft-panel-${currency}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setNftExpanded((prev) => ({ ...prev, [currency]: !prev[currency] }))
                              }}
                            >
                              {isOpen ? '− NFTs' : '+ NFTs'}
                            </button>
                          )
                        })()}
                      </td>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {kind === 'crypto' && (['ETH', 'TRB'] as NftCurrency[]).some((currency) => nftExpanded[currency] && ownedRows.some((row) => row.asset.name.toUpperCase() === currency)) && (
            <div className="nft-register">
              <div className="row">
                <h4 className="section-title" style={{ margin: 0 }}>NFTs</h4>
                <span className="results-count spacer">fixed prices · current dollar value</span>
              </div>
              {(['ETH', 'TRB'] as NftCurrency[]).map((currency) => {
                if (!nftExpanded[currency]) return null
                const row = ownedRows.find((item) => item.asset.name.toUpperCase() === currency)
                if (!row) return null
                const currentPrice = row.priceValid ? row.price : 0
                const ownedSorted = [...ownedNfts[currency]]
                  .map((name) => nfts[currency].find((n) => n.name === name)!)
                  .filter(Boolean)
                  .sort((a, b) => a.price - b.price)
                return (
                  <div className="nft-group nft-group-open" key={currency} id={`nft-panel-${currency}`}>
                    <div className="nft-group-top">
                      <div className="nft-group-heading">
                        <strong>NFT Collection</strong>
                        <span className="nft-owned-with-trade">
                          <span className="results-count">
                            {ownedSorted.length === 0
                              ? 'none owned'
                              : `${ownedSorted.length} owned`}
                          </span>
                          <button
                            type="button"
                            className="nft-buy-round"
                            onClick={() => setNftDialog(currency)}
                            aria-label={`Trade ${currency} NFT`}
                            title={`Trade ${currency} NFT`}
                          >
                            Trade
                          </button>
                        </span>
                      </div>
                    </div>
                    {ownedSorted.length === 0 ? (
                      <p className="nft-empty">No NFTs yet — tap Buy to collect.</p>
                    ) : (
                      <>
                        <div className="nft-columns nft-columns-header">
                          <span>NFT</span>
                          <span>{currency}</span>
                          <span>Dollars</span>
                        </div>
                        <ul>
                          {ownedSorted.map((item) => (
                            <li key={item.name}>
                              <span>{item.name}</span>
                              <span>{item.price.toLocaleString()}</span>
                              <span>{currentPrice > 0 ? formatMoney(item.price * currentPrice) : '—'}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="nft-total nft-columns">
                          <span>Real {currency} investment</span>
                          <strong>{nftCost(currency).toLocaleString()}</strong>
                          <strong>{currentPrice > 0 ? formatMoney(nftCost(currency) * currentPrice) : '—'}</strong>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {tradePosition && (
        <TradeDialog
          position={tradePosition}
          priceText={priceInput}
          sessionRealized={
            getAssetRealized(realizedPnl, tradePosition.asset.kind, tradePosition.asset.id)
              ?.realized ? Number(getAssetRealized(realizedPnl, tradePosition.asset.kind, tradePosition.asset.id)!.realized) : 0
          }
          onClose={() => setTradePosition(null)}
          onBuy={handleTradeBuy}
          onSell={handleTradeSell}
          onPriceChange={handleTradePriceChange}
          onTotalInvestedChange={handleTradePriceChange}
          onPriceBlur={commitPriceBasis}
        />
      )}
      {nftDialog && (
        <NftDialog currency={nftDialog} options={nfts[nftDialog]} owned={ownedNfts[nftDialog]} onBuy={(name) => buyNft(nftDialog, name)} onClose={() => setNftDialog(null)} />
      )}

      <div className="grid-2 invest-layout">
        <section className="card">
          <div className="row" style={{ marginBottom: '0.75rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              {kindTitle(kind)}
            </h3>
            <span className="results-count spacer">
              {query.trim()
                ? `${matches.length} shown`
                : `${assetsCount(kind)} assets`}
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
              placeholder={
                kind === 'stock'
                  ? 'e.g. Tassla, Pineapple, MVIDIA…'
                  : kind === 'crypto'
                    ? 'e.g. BTC, Solana…'
                    : 'e.g. Gold, Silver, Diamonds…'
              }
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
                  <div className="stat-label">{unitWord(selected, 'title')} held</div>
                  <div className="stat-value">
                    {shares != null ? shares.toLocaleString() : '0'}
                  </div>
                  <div className="stat-hint" style={{ marginTop: '0.35rem' }}>
                    {shares != null
                      ? 'Use BUY / SELL on the verdict (or the owned table) to change this position. Average cost updates automatically.'
                      : `No position yet — enter a price, then tap BUY on the verdict to open ${unitWord(selected, 'plural')} via the trade dialog.`}
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
                <strong>BUY</strong> or <strong>SELL</strong> {unitWord(kind, 'plural')} in the
                trade dialog.
              </li>
              <li>
                <strong>Potential</strong> = (Max − Price) / Price — remaining upside to your tracked
                max.
              </li>
              <li>
                Price <strong>below average</strong> → <strong>BUY</strong>
              </li>
              <li>
                Price <strong>at/above average</strong> + you hold {unitWord(kind, 'plural')} →{' '}
                <strong>SELL</strong>
              </li>
              <li>
                Price <strong>at/above average</strong> + no {unitWord(kind, 'plural')} →{' '}
                <strong>HOLD</strong> (wait)
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
