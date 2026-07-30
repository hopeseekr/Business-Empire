import type { InvestmentKind } from '../types'
import { assetStorageKey } from './investmentStorage'
import { addFixed8, formatFixed8, parseFixed8 } from './fixedPoint'

/** Persists across tabs and browser restarts (localStorage). */
const STORAGE_KEY = 'business-empire.realized-pnl.v1'

export interface AssetRealizedPnl {
  /** Cumulative realized $ P&L for this asset. */
  realized: string
  /** Number of sell lots recorded. */
  sellCount: number
  name: string
}

export interface RealizedPnlState {
  version: 1
  /** Totals by market bucket. */
  byKind: {
    stock: string
    crypto: string
    bullion: string
  }
  /** Per-asset cumulative realized P&L (`kind:id` → stats). */
  byAsset: Record<string, AssetRealizedPnl>
}

function emptyState(): RealizedPnlState {
  return {
    version: 1,
    byKind: { stock: '0', crypto: '0', bullion: '0' },
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
      stock: parseStoredAmount(parsed.byKind?.stock),
      crypto: parseStoredAmount(parsed.byKind?.crypto),
      bullion: parseStoredAmount(parsed.byKind?.bullion),
    }

    const byAsset: Record<string, AssetRealizedPnl> = {}
    if (parsed.byAsset && typeof parsed.byAsset === 'object') {
      for (const [key, value] of Object.entries(parsed.byAsset)) {
        if (!value || typeof value !== 'object') continue
        const realized = parseStoredAmount((value as AssetRealizedPnl).realized)
        const sellCount = Number((value as AssetRealizedPnl).sellCount)
        const name = String((value as AssetRealizedPnl).name ?? key)
        if (realized == null) continue
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

function parseStoredAmount(value: unknown): string {
  const parsed = parseFixed8(String(value ?? ''))
  return parsed == null ? '0' : formatFixed8(parsed)
}

export function saveRealizedPnl(state: RealizedPnlState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // private mode / quota
  }
}

/**
 * Add one sale's booked profit to the cumulative trader log.
 * The amount comes from allocateSaleProceeds (profit-first allocation), so a sale
 * that only returns capital records a zero-dollar lot rather than a phantom gain.
 * This log is lifetime history — liquidating a position never resets it.
 */
export function recordRealizedDelta(
  state: RealizedPnlState,
  kind: InvestmentKind,
  id: number,
  name: string,
  delta: string,
): RealizedPnlState {
  if (!isKind(kind)) return state
  if (parseFixed8(delta) == null) return state

  const key = assetStorageKey(kind, id)
  const prev = state.byAsset[key]

  return {
    version: 1,
    byKind: {
      ...state.byKind,
      [kind]: addFixed8(state.byKind[kind], delta) ?? state.byKind[kind],
    },
    byAsset: {
      ...state.byAsset,
      [key]: {
        name,
        realized: addFixed8(prev?.realized ?? '0', delta) ?? prev?.realized ?? '0',
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

export function formatSignedMoney(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value)
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
