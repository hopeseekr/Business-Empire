import type { InvestmentKind } from '../types'
import { assetStorageKey } from './investmentStorage'

/** Persists across tabs and browser restarts (localStorage). */
const STORAGE_KEY = 'business-empire.realized-pnl.v1'

export interface AssetRealizedPnl {
  /** Cumulative realized $ P&L for this asset. */
  realized: number
  /** Number of sell lots recorded. */
  sellCount: number
  name: string
}

export interface RealizedPnlState {
  version: 1
  /** Totals by market bucket. */
  byKind: {
    stock: number
    crypto: number
    bullion: number
  }
  /** Per-asset cumulative realized P&L (`kind:id` → stats). */
  byAsset: Record<string, AssetRealizedPnl>
}

function emptyState(): RealizedPnlState {
  return {
    version: 1,
    byKind: { stock: 0, crypto: 0, bullion: 0 },
    byAsset: {},
  }
}

function isKind(value: unknown): value is InvestmentKind {
  return value === 'stock' || value === 'crypto' || value === 'bullion'
}

/** Load realized P&L from localStorage; corrupt/missing → zeros. */
export function loadRealizedPnl(): RealizedPnlState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()

    const parsed = JSON.parse(raw) as Partial<RealizedPnlState>
    const byKind = {
      stock: Number.isFinite(parsed.byKind?.stock) ? Number(parsed.byKind!.stock) : 0,
      crypto: Number.isFinite(parsed.byKind?.crypto) ? Number(parsed.byKind!.crypto) : 0,
      bullion: Number.isFinite(parsed.byKind?.bullion)
        ? Number(parsed.byKind!.bullion)
        : 0,
    }

    const byAsset: Record<string, AssetRealizedPnl> = {}
    if (parsed.byAsset && typeof parsed.byAsset === 'object') {
      for (const [key, value] of Object.entries(parsed.byAsset)) {
        if (!value || typeof value !== 'object') continue
        const realized = Number((value as AssetRealizedPnl).realized)
        const sellCount = Number((value as AssetRealizedPnl).sellCount)
        const name = String((value as AssetRealizedPnl).name ?? key)
        if (!Number.isFinite(realized)) continue
        byAsset[key] = {
          realized,
          sellCount: Number.isFinite(sellCount) ? sellCount : 0,
          name,
        }
      }
    }

    return { version: 1, byKind, byAsset }
  } catch {
    return emptyState()
  }
}

export function saveRealizedPnl(state: RealizedPnlState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // private mode / quota
  }
}

/**
 * Record a sell lot's realized gain/loss.
 * realized = (sellPrice − costBasis) × sharesSold
 */
export function recordRealizedSell(
  state: RealizedPnlState,
  kind: InvestmentKind,
  id: number,
  name: string,
  sellPrice: number,
  costBasis: number,
  sharesSold: number,
): RealizedPnlState {
  if (!isKind(kind)) return state
  if (!(sharesSold > 0) || !(sellPrice > 0) || !(costBasis > 0)) return state

  const delta = (sellPrice - costBasis) * sharesSold
  if (!Number.isFinite(delta)) return state

  const key = assetStorageKey(kind, id)
  const prev = state.byAsset[key]

  return {
    version: 1,
    byKind: {
      ...state.byKind,
      [kind]: state.byKind[kind] + delta,
    },
    byAsset: {
      ...state.byAsset,
      [key]: {
        name,
        realized: (prev?.realized ?? 0) + delta,
        sellCount: (prev?.sellCount ?? 0) + 1,
      },
    },
  }
}

export function getAssetRealized(
  state: RealizedPnlState,
  kind: InvestmentKind,
  id: number,
): AssetRealizedPnl | null {
  return state.byAsset[assetStorageKey(kind, id)] ?? null
}

export function formatSignedMoney(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  if (n > 0) return `+${formatted}`
  if (n < 0) return `−${formatted}`
  return formatted
}
