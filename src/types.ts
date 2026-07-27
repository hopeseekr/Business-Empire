export interface ClothingCollection {
  name: string
  style: string
  quality: string
  price: string
  audience: string
}

export type BusinessId = 'clothing' | 'investments'

export interface BusinessMeta {
  id: BusinessId
  name: string
  shortName: string
  description: string
  status: 'live' | 'coming-soon'
  icon: string
}

export type InvestmentKind = 'stock' | 'crypto' | 'bullion'

/** Quantity unit for an asset (drives UI copy: shares / coins / ingots / carats). */
export type InvestmentUnit = 'share' | 'coin' | 'ingot' | 'carat'

/** Raw row shape from investments-*.json (currency strings from the spreadsheet). */
export interface InvestmentRaw {
  id: number
  asset: string
  /** Optional; bullion sets ingot/carat. Stocks default to share, crypto to coin. */
  unit?: InvestmentUnit
  max: string
  min: string
  average: string
  max_gain: string
  now: string
  potential: string
  recommendation?: string
  active?: string
}

/** Parsed asset with numeric range stats used for live calculations. */
export interface InvestmentAsset {
  id: number
  kind: InvestmentKind
  name: string
  /** Quantity unit shown in trade UI (share / coin / ingot / carat). */
  unit: InvestmentUnit
  max: number
  min: number
  average: number
  /** Historical max gain (Max − Min) / Min. */
  maxGain: number
  /** Last recorded in-game price from the spreadsheet (starter value only). */
  lastNow: number
}

export type TradeAction = 'BUY' | 'HOLD' | 'SELL'

export interface TradeAnalysis {
  price: number
  shares: number | null
  potentialPct: number
  /** Upside per share to historical max (Max − price). */
  upsidePerShare: number
  /** Total upside if shares are provided: shares × (Max − price). */
  totalUpside: number | null
  positionValue: number | null
  action: TradeAction
  /** Where price sits in the Min–Max band (0 = min, 1 = max). */
  rangePosition: number
}
