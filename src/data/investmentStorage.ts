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
   * First valid price ever recorded for this asset (cost basis).
   * Set once and never overwritten by later price edits.
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
 * True when `basis` looks like a digit-by-digit typing lock of `fullPrice`
 * (e.g. firstPrice "9" or "939." while price is "939.74") rather than a real cost basis.
 */
export function isKeystrokeBasisArtifact(basis: string, fullPrice: string): boolean {
  const b = basis.trim()
  const f = fullPrice.trim()
  if (!b || !f || b === f) return false
  // Trailing decimal is always incomplete — check before startsWith
  // ( "939." is not a prefix of "963.02" but is still corrupt ).
  if (b.endsWith('.')) return true
  if (!f.startsWith(b)) return false
  // Classic bug locks on the first 1–2 keystrokes while the committed price is longer.
  // Avoid treating real moves like $9 → $90 as artifacts (full price only +1 char).
  if (b.length <= 2 && f.length >= b.length + 2) return true
  // Longer partial locks: "939" while typing "939.74" (integer prefix before fraction).
  if (!b.includes('.') && f.length > b.length && /^[\d.]/.test(f.slice(b.length))) {
    const bNum = parseUserNumber(b)
    const fNum = parseUserNumber(f)
    if (bNum != null && fNum != null && fNum / bNum < 1.5) return true
  }
  return false
}

/**
 * Cost basis for an entry, repairing incomplete / keystroke-lock firstPrice values.
 * "939." → "939" (strip dangling dot); "9" vs live "939.74" → live when clearly partial.
 */
export function resolveFirstPrice(entry: StoredAssetEntry): string | undefined {
  const live = canonicalPriceString(entry.price)
  // Normalize "939." → "939" rather than throwing away the intended ~$939 basis.
  const explicit = canonicalPriceString(entry.firstPrice)

  if (explicit && live && isKeystrokeBasisArtifact(explicit, live)) return live
  // Raw firstPrice still had a dangling dot but stripped form is usable.
  if (explicit) return explicit
  if (live) return live
  return undefined
}

/** Normalize a stored entry (repair bad firstPrice; never persist "939."). */
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
   * Callers should only set this on commit (price blur, buy, or shares becoming held) —
   * never on every keystroke, or the first typed digit becomes permanent basis.
   */
  establishBasis?: boolean
}

/**
 * Update or remove an entry in the in-memory map.
 * Empty price+shares deletes the map key (and should be followed by persist).
 * firstPrice (cost basis) is permanent once set; it is never overwritten and never
 * dropped when the live price is cleared/zeroed. New basis is only taken from the
 * live price when `establishBasis` is set (or when clearing a valid price that had
 * no basis yet — snapshot so a blank+retype cannot lock the first keystroke).
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

  // 1) Keep / repair basis from previous entry only.
  //    Do not rewrite basis from the live price on every keystroke (that froze "939.").
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

  // 3) Commit only (blur / buy / open position): lock or repair from full price.
  if (options?.establishBasis && priceForBasis) {
    if (
      !firstPrice ||
      firstPrice.endsWith('.') ||
      isKeystrokeBasisArtifact(firstPrice, priceForBasis)
    ) {
      firstPrice = priceForBasis
    }
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
