import type { InvestmentAsset, InvestmentKind } from '../types'
import { assetsFor, parseUserNumber } from './investments'

/** Legacy monolithic blob (migrated away on first load). */
const LEGACY_STORAGE_KEY = 'business-empire.investments.v1'

/** UI prefs only (active tab + last selection) — not per-asset data. */
const META_STORAGE_KEY = 'business-empire.investments.v2.meta'

/**
 * Per-asset localStorage key prefix.
 * Full key example: `business-empire.investments.v2.asset.crypto:10`
 */
const ASSET_KEY_PREFIX = 'business-empire.investments.v2.asset.'

export interface StoredAssetEntry {
  /** Latest price the user entered. */
  price: string
  shares: string
  /**
   * Average cost basis per share for this position.
   * Not overwritten by live price edits; updated by trades (weighted buy,
   * unchanged on partial sell, cleared on full exit).
   */
  firstPrice?: string
}

export interface InvestmentMeta {
  version: 2
  kind: InvestmentKind
  selectedIds: {
    stock: number | null
    crypto: number | null
  }
}

/** In-memory prefs shape used by the Investments page. */
export interface InvestmentPrefs {
  version: 2
  kind: InvestmentKind
  selectedIds: {
    stock: number | null
    crypto: number | null
  }
  /** Map of "kind:id" → last price/shares inputs (mirrors per-asset localStorage keys). */
  entries: Record<string, StoredAssetEntry>
}

function emptyMeta(): InvestmentMeta {
  return {
    version: 2,
    kind: 'stock',
    selectedIds: { stock: null, crypto: null },
  }
}

function emptyPrefs(): InvestmentPrefs {
  return {
    ...emptyMeta(),
    entries: {},
  }
}

/** In-memory / map key: `crypto:10`. */
export function assetStorageKey(kind: InvestmentKind, id: number): string {
  return `${kind}:${id}`
}

/** localStorage key for one asset: `business-empire.investments.v2.asset.crypto:10`. */
export function assetLocalStorageKey(kind: InvestmentKind, id: number): string {
  return `${ASSET_KEY_PREFIX}${assetStorageKey(kind, id)}`
}

function parseAssetStorageKey(
  mapKey: string,
): { kind: InvestmentKind; id: number } | null {
  const match = /^(stock|crypto):(\d+)$/.exec(mapKey)
  if (!match) return null
  return { kind: match[1] as InvestmentKind, id: Number(match[2]) }
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

/**
 * Complete numeric price string suitable for cost basis.
 * Rejects empty/non-positive; strips a dangling decimal so "939." → "939"
 * (Number("939.") === 939, but we must never persist the incomplete form).
 */
function canonicalPriceString(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let t = raw.trim()
  if (!t) return undefined
  if (t.endsWith('.')) t = t.replace(/\.+$/, '')
  if (!t) return undefined
  const n = parseUserNumber(t)
  return n != null && n > 0 ? t : undefined
}

/**
 * Cost basis for an entry.
 * Prefers an explicit firstPrice (average-cost basis from trades) over live price.
 * Does not rewrite basis just because live price moved (e.g. basis $10, live $10.50).
 * Trades update basis via upsertEntry `costBasis`; establishBasis only locks when missing.
 */
export function resolveFirstPrice(entry: StoredAssetEntry): string | undefined {
  // Normalize "939." → "939" rather than throwing away the intended ~$939 basis.
  const explicit = canonicalPriceString(entry.firstPrice)
  if (explicit) return explicit
  const live = canonicalPriceString(entry.price)
  if (live) return live
  return undefined
}

/**
 * Format a numeric cost basis for storage (trim float noise, keep usable precision).
 */
export function formatCostBasis(n: number): string {
  if (!Number.isFinite(n) || !(n > 0)) return ''
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n))
  return n.toFixed(8).replace(/\.?0+$/, '')
}

/**
 * Average cost per share after buying more (average-cost method).
 * Opening a position (no prior shares / basis) → buyPrice.
 */
export function averageCostAfterBuy(
  heldShares: number,
  costBasisPerShare: number,
  buyShares: number,
  buyPrice: number,
): number {
  if (!(buyShares > 0) || !(buyPrice > 0)) {
    return costBasisPerShare > 0 ? costBasisPerShare : buyPrice
  }
  if (!(heldShares > 0) || !(costBasisPerShare > 0)) {
    return buyPrice
  }
  return (heldShares * costBasisPerShare + buyShares * buyPrice) / (heldShares + buyShares)
}

/**
 * Cost basis after selling under the average-cost method.
 * Partial sell: per-share basis unchanged. Full exit: null (clear basis).
 */
export function averageCostAfterSell(
  heldShares: number,
  costBasisPerShare: number,
  sellShares: number,
): number | null {
  if (!(sellShares > 0)) {
    return costBasisPerShare > 0 ? costBasisPerShare : null
  }
  const remaining = heldShares - sellShares
  if (!(remaining > 1e-12)) return null
  return costBasisPerShare > 0 ? costBasisPerShare : null
}

/** Normalize a stored entry (repair dangling-decimal firstPrice; never invent from keystrokes). */
export function sanitizeStoredEntry(value: StoredAssetEntry): StoredAssetEntry {
  const basis = resolveFirstPrice(value)
  return {
    price: value.price,
    shares: value.shares,
    ...(basis ? { firstPrice: basis } : {}),
  }
}

function entryIsEmpty(entry: StoredAssetEntry): boolean {
  return !entry.price.trim() && !entry.shares.trim()
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota / private mode
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Load one asset’s localStorage record (or null if missing/corrupt). */
export function loadAssetEntry(
  kind: InvestmentKind,
  id: number,
): StoredAssetEntry | null {
  const raw = readJson<unknown>(assetLocalStorageKey(kind, id))
  if (!isEntry(raw)) return null
  return sanitizeStoredEntry(raw)
}

/**
 * Persist or clear one asset’s localStorage record.
 * Empty price+shares removes the key entirely.
 */
export function saveAssetEntry(
  kind: InvestmentKind,
  id: number,
  entry: StoredAssetEntry | null,
): void {
  const lsKey = assetLocalStorageKey(kind, id)
  if (!entry || entryIsEmpty(entry)) {
    removeKey(lsKey)
    return
  }
  writeJson(lsKey, sanitizeStoredEntry(entry))
}

function listAssetLocalStorageKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(ASSET_KEY_PREFIX)) keys.push(key)
    }
  } catch {
    // ignore
  }
  return keys
}

/** Load every per-asset record into a `kind:id` → entry map. */
export function loadAllAssetEntries(): Record<string, StoredAssetEntry> {
  const entries: Record<string, StoredAssetEntry> = {}
  for (const lsKey of listAssetLocalStorageKeys()) {
    const mapKey = lsKey.slice(ASSET_KEY_PREFIX.length)
    if (!parseAssetStorageKey(mapKey)) continue
    const raw = readJson<unknown>(lsKey)
    if (!isEntry(raw)) continue
    const sanitized = sanitizeStoredEntry(raw)
    if (entryIsEmpty(sanitized)) {
      removeKey(lsKey)
      continue
    }
    entries[mapKey] = sanitized
  }
  return entries
}

function loadMeta(): InvestmentMeta {
  const parsed = readJson<Partial<InvestmentMeta>>(META_STORAGE_KEY)
  if (!parsed) return emptyMeta()
  return {
    version: 2,
    kind: isKind(parsed.kind) ? parsed.kind : 'stock',
    selectedIds: {
      stock:
        typeof parsed.selectedIds?.stock === 'number' ? parsed.selectedIds.stock : null,
      crypto:
        typeof parsed.selectedIds?.crypto === 'number' ? parsed.selectedIds.crypto : null,
    },
  }
}

function saveMeta(meta: Omit<InvestmentMeta, 'version'>): void {
  writeJson(META_STORAGE_KEY, {
    version: 2 as const,
    kind: meta.kind,
    selectedIds: meta.selectedIds,
  })
}

/**
 * One-time migration: split legacy monolithic v1 blob into meta + per-asset keys.
 * Removes the legacy key after a successful split.
 */
function migrateLegacyV1IfNeeded(): void {
  const raw = readJson<Partial<{
    version: number
    kind: unknown
    selectedIds: InvestmentMeta['selectedIds']
    entries: Record<string, unknown>
  }>>(LEGACY_STORAGE_KEY)
  if (!raw) return

  // Prefer existing v2 meta if present; otherwise take from legacy.
  const existingMeta = readJson<unknown>(META_STORAGE_KEY)
  if (!existingMeta) {
    saveMeta({
      kind: isKind(raw.kind) ? raw.kind : 'stock',
      selectedIds: {
        stock:
          typeof raw.selectedIds?.stock === 'number' ? raw.selectedIds.stock : null,
        crypto:
          typeof raw.selectedIds?.crypto === 'number' ? raw.selectedIds.crypto : null,
      },
    })
  }

  if (raw.entries && typeof raw.entries === 'object') {
    for (const [mapKey, value] of Object.entries(raw.entries)) {
      const parsed = parseAssetStorageKey(mapKey)
      if (!parsed || !isEntry(value)) continue
      // Don't clobber a newer per-asset key if migration re-runs.
      const lsKey = assetLocalStorageKey(parsed.kind, parsed.id)
      if (localStorage.getItem(lsKey) != null) continue
      saveAssetEntry(parsed.kind, parsed.id, value)
    }
  }

  removeKey(LEGACY_STORAGE_KEY)
}

/** Load investment prefs from localStorage; falls back to defaults on missing/corrupt data. */
export function loadInvestmentPrefs(): InvestmentPrefs {
  try {
    migrateLegacyV1IfNeeded()
    const meta = loadMeta()
    const entries = loadAllAssetEntries()
    return {
      version: 2,
      kind: meta.kind,
      selectedIds: meta.selectedIds,
      entries,
    }
  } catch {
    return emptyPrefs()
  }
}

/**
 * Persist UI meta + every in-memory asset entry as its own localStorage key.
 * Assets removed from `entries` (cleared price+shares) have their keys deleted.
 */
export function saveInvestmentPrefs(prefs: InvestmentPrefs): void {
  try {
    saveMeta({ kind: prefs.kind, selectedIds: prefs.selectedIds })

    const desired = new Set<string>()
    for (const [mapKey, value] of Object.entries(prefs.entries)) {
      const parsed = parseAssetStorageKey(mapKey)
      if (!parsed) continue
      const sanitized = sanitizeStoredEntry(value)
      if (entryIsEmpty(sanitized)) {
        removeKey(assetLocalStorageKey(parsed.kind, parsed.id))
        continue
      }
      desired.add(assetLocalStorageKey(parsed.kind, parsed.id))
      writeJson(assetLocalStorageKey(parsed.kind, parsed.id), sanitized)
    }

    // Drop orphan per-asset keys no longer present in memory.
    for (const lsKey of listAssetLocalStorageKeys()) {
      if (!desired.has(lsKey)) removeKey(lsKey)
    }
  } catch {
    // ignore
  }
}

/**
 * Write a single asset after an in-memory upsert (avoids rewriting every key).
 * Pass null / empty entry to delete that asset’s localStorage key.
 */
export function persistAssetFromMap(
  entries: Record<string, StoredAssetEntry>,
  kind: InvestmentKind,
  id: number,
): void {
  const mapKey = assetStorageKey(kind, id)
  const entry = entries[mapKey]
  saveAssetEntry(kind, id, entry ?? null)
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

export interface UpsertEntryOptions {
  /**
   * When true, lock cost basis from the new price if no basis exists yet.
   * Callers should only set this on commit (price blur, or shares becoming held) —
   * never on every keystroke, or the first typed digit becomes permanent basis.
   * Ignored when `costBasis` is provided (trade accounting owns the basis).
   */
  establishBasis?: boolean
  /**
   * Explicit average-cost basis from a trade.
   * - string: set / overwrite cost basis (weighted buy, or unchanged after partial sell)
   * - null: clear cost basis (full exit)
   * When set, wins over establishBasis and the previous firstPrice.
   */
  costBasis?: string | null
}

/**
 * Update or remove an entry in the in-memory map.
 * Empty price+shares deletes the map key (and should be followed by persist).
 *
 * Cost basis (firstPrice) rules:
 * - Trade paths pass `costBasis` to set a weighted average or clear on full exit.
 * - Otherwise basis is sticky: not overwritten by live price edits, and not dropped
 *   when price is cleared/zeroed.
 * - `establishBasis` only locks from live price when missing / keystroke-corrupt.
 */
export function upsertEntry(
  entries: Record<string, StoredAssetEntry>,
  kind: InvestmentKind,
  id: number,
  price: string,
  shares: string,
  options?: UpsertEntryOptions,
): Record<string, StoredAssetEntry> {
  const key = assetStorageKey(kind, id)
  if (!price.trim() && !shares.trim()) {
    if (!(key in entries)) return entries
    const next = { ...entries }
    delete next[key]
    return next
  }

  const prev = entries[key]
  const priceForBasis = canonicalPriceString(price)

  // Explicit trade basis always wins (including clear on full exit).
  if (options && 'costBasis' in options && options.costBasis !== undefined) {
    const tradeBasis =
      options.costBasis === null ? undefined : canonicalPriceString(options.costBasis)
    return {
      ...entries,
      [key]: {
        price,
        shares,
        ...(tradeBasis ? { firstPrice: tradeBasis } : {}),
      },
    }
  }

  // 1) Keep basis from previous entry only (do not pull live price into basis on keystrokes).
  let firstPrice: string | undefined
  if (prev) {
    firstPrice = resolveFirstPrice({
      price: prev.price,
      shares: prev.shares,
      firstPrice: prev.firstPrice,
    })
  }

  // 2) Snapshot outgoing complete live price when clearing/zeroing before a basis exists.
  if (!firstPrice && prev) {
    const prevLive = canonicalPriceString(prev.price)
    if (prevLive && !priceForBasis) firstPrice = prevLive
  }

  // 3) Commit only (blur / open position): lock basis from full price when missing.
  //    Never overwrite an existing complete basis with live price — that would destroy
  //    average-cost after buys (e.g. basis $10 while live is $100) and treat short
  //    bases as keystroke artifacts. Trades pass `costBasis` to update explicitly.
  //    Incomplete "939." is already normalized by canonicalPriceString above.
  if (options?.establishBasis && priceForBasis && !firstPrice) {
    firstPrice = priceForBasis
  }

  // Never persist dangling-decimal basis.
  firstPrice = canonicalPriceString(firstPrice)

  return {
    ...entries,
    [key]: {
      price,
      shares,
      ...(firstPrice ? { firstPrice } : {}),
    },
  }
}
