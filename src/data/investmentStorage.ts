import type { InvestmentAsset, InvestmentKind } from '../types'
import { assetsFor, parseUserNumber } from './investments'

const STORAGE_KEY = 'business-empire.investments.v1'

export interface StoredAssetEntry {
  /** Latest price the user entered. */
  price: string
  shares: string
  /**
   * First valid price ever recorded for this asset (cost basis).
   * Set once and never overwritten by later price edits.
   */
  firstPrice?: string
}

export interface InvestmentPrefs {
  version: 1
  kind: InvestmentKind
  /** Last selected asset id per tab. */
  selectedIds: {
    stock: number | null
    crypto: number | null
  }
  /** Map of "kind:id" → last price/shares inputs. */
  entries: Record<string, StoredAssetEntry>
}

function emptyPrefs(): InvestmentPrefs {
  return {
    version: 1,
    kind: 'stock',
    selectedIds: { stock: null, crypto: null },
    entries: {},
  }
}

export function assetStorageKey(kind: InvestmentKind, id: number): string {
  return `${kind}:${id}`
}

function isKind(value: unknown): value is InvestmentKind {
  return value === 'stock' || value === 'crypto'
}

function isEntry(value: unknown): value is StoredAssetEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.price !== 'string' || typeof v.shares !== 'string') return false
  if (v.firstPrice !== undefined && typeof v.firstPrice !== 'string') return false
  return true
}

function isValidPriceString(raw: string | undefined): raw is string {
  if (!raw || !raw.trim()) return false
  const n = parseUserNumber(raw)
  return n != null && n > 0
}

/**
 * Resolve cost-basis first price for an entry.
 * Existing entries without firstPrice treat the stored price as the baseline.
 */
export function resolveFirstPrice(entry: StoredAssetEntry): string | undefined {
  if (isValidPriceString(entry.firstPrice)) return entry.firstPrice.trim()
  if (isValidPriceString(entry.price)) return entry.price.trim()
  return undefined
}

/** Load investment prefs from localStorage; falls back to defaults on missing/corrupt data. */
export function loadInvestmentPrefs(): InvestmentPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPrefs()

    const parsed = JSON.parse(raw) as Partial<InvestmentPrefs>
    const kind = isKind(parsed.kind) ? parsed.kind : 'stock'

    const selectedIds = {
      stock:
        typeof parsed.selectedIds?.stock === 'number' ? parsed.selectedIds.stock : null,
      crypto:
        typeof parsed.selectedIds?.crypto === 'number' ? parsed.selectedIds.crypto : null,
    }

    const entries: Record<string, StoredAssetEntry> = {}
    if (parsed.entries && typeof parsed.entries === 'object') {
      for (const [key, value] of Object.entries(parsed.entries)) {
        if (!isEntry(value)) continue
        const firstPrice = resolveFirstPrice(value)
        entries[key] = {
          price: value.price,
          shares: value.shares,
          ...(firstPrice ? { firstPrice } : {}),
        }
      }
    }

    return { version: 1, kind, selectedIds, entries }
  } catch {
    return emptyPrefs()
  }
}

/** Persist investment prefs. Silently ignores quota / private-mode failures. */
export function saveInvestmentPrefs(prefs: InvestmentPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

/** Resolve a stored asset id to a live asset, or null if it no longer exists. */
export function resolveStoredAsset(
  kind: InvestmentKind,
  id: number | null,
): InvestmentAsset | null {
  if (id == null) return null
  return assetsFor(kind).find((a) => a.id === id) ?? null
}

export function getStoredEntry(
  entries: Record<string, StoredAssetEntry>,
  kind: InvestmentKind,
  id: number,
): StoredAssetEntry {
  return entries[assetStorageKey(kind, id)] ?? { price: '', shares: '' }
}

/**
 * Update or remove an entry.
 * Empty price+shares deletes the key.
 * firstPrice is set on the first valid price and never overwritten afterward.
 */
export function upsertEntry(
  entries: Record<string, StoredAssetEntry>,
  kind: InvestmentKind,
  id: number,
  price: string,
  shares: string,
): Record<string, StoredAssetEntry> {
  const key = assetStorageKey(kind, id)
  if (!price.trim() && !shares.trim()) {
    if (!(key in entries)) return entries
    const next = { ...entries }
    delete next[key]
    return next
  }

  const prev = entries[key]
  const existingFirst = prev ? resolveFirstPrice(prev) : undefined
  const firstPrice =
    existingFirst ?? (isValidPriceString(price) ? price.trim() : undefined)

  return {
    ...entries,
    [key]: {
      price,
      shares,
      ...(firstPrice ? { firstPrice } : {}),
    },
  }
}
