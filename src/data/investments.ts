import stocksRaw from './investments-stocks.json'
import cryptoRaw from './investments-crypto.json'
import type {
  InvestmentAsset,
  InvestmentKind,
  InvestmentRaw,
  TradeAction,
  TradeAnalysis,
} from '../types'

/** Parse "$36,392.79", "5.32 %", "37.83%" etc. into a number. */
export function parseMoney(value: string | number): number {
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[$,%\s]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function toAsset(raw: InvestmentRaw, kind: InvestmentKind): InvestmentAsset {
  const max = parseMoney(raw.max)
  const min = parseMoney(raw.min)
  return {
    id: raw.id,
    kind,
    name: raw.asset,
    max,
    min,
    average: parseMoney(raw.average),
    maxGain: min > 0 ? (max - min) / min : 0,
    lastNow: parseMoney(raw.now),
  }
}

export const stocks: InvestmentAsset[] = (stocksRaw as InvestmentRaw[]).map((r) =>
  toAsset(r, 'stock'),
)

export const cryptos: InvestmentAsset[] = (cryptoRaw as InvestmentRaw[]).map((r) =>
  toAsset(r, 'crypto'),
)

export function assetsFor(kind: InvestmentKind): InvestmentAsset[] {
  return kind === 'stock' ? stocks : cryptos
}

export function searchAssets(kind: InvestmentKind, query: string): InvestmentAsset[] {
  const q = query.trim().toLowerCase()
  const list = assetsFor(kind)
  if (!q) return list
  return list.filter((a) => a.name.toLowerCase().includes(q))
}

/**
 * Remaining upside to the historical max, as a fraction of current price.
 * Matches the spreadsheet: Potential = (Max − Now) / Now
 */
export function potentialPct(max: number, price: number): number {
  if (!(price > 0)) return NaN
  return ((max - price) / price) * 100
}

/**
 * BUY / HOLD / SELL from the spreadsheet rules:
 * - Price below average → BUY (was "YE" in the sheet)
 * - Price at/above average and holding shares → SELL
 * - Price at/above average and not holding → HOLD
 */
export function recommendAction(price: number, average: number, holding: boolean): TradeAction {
  if (price < average) return 'BUY'
  if (holding) return 'SELL'
  return 'HOLD'
}

export function analyzeTrade(
  asset: InvestmentAsset,
  price: number,
  shares: number | null,
): TradeAnalysis {
  const holding = shares != null && shares > 0
  const upsidePerShare = asset.max - price
  const rangeSpan = asset.max - asset.min
  const rangePosition =
    rangeSpan > 0 ? Math.min(1, Math.max(0, (price - asset.min) / rangeSpan)) : 0.5

  return {
    price,
    shares,
    potentialPct: potentialPct(asset.max, price),
    upsidePerShare,
    totalUpside: holding ? shares! * upsidePerShare : null,
    positionValue: holding ? shares! * price : null,
    action: recommendAction(price, asset.average, holding),
    rangePosition,
  }
}

export function formatMoney(n: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const fractionDigits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: opts?.compact ? 2 : fractionDigits,
  }).format(n)
}

export function formatPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

/** Parse user input that may include $, commas, or spaces. Empty → null. */
export function parseUserNumber(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = parseMoney(t)
  return Number.isFinite(n) ? n : null
}
