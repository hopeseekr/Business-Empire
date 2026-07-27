import type { InvestmentAsset, InvestmentKind } from '../types'
import { assetsFor } from './investments'

const STORAGE_KEY = 'business-empire.investments.v1'

export interface StoredAssetEntry {
  price: string
  shares: string
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
  return typeof v.price === 'string' && typeof v.shares === 'string'
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
        if (isEntry(value)) {
          entries[key] = { price: value.price, shares: value.shares }
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

/** Update or remove an entry; empty price+shares deletes the key. */
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
  return { ...entries, [key]: { price, shares } }
}
