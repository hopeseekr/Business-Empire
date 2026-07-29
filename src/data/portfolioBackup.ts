import type { InvestmentKind } from '../types'
import {
  sanitizeStoredEntry,
  type InvestmentPrefs,
  type StoredAssetEntry,
} from './investmentStorage'
import type { AssetRealizedPnl, RealizedPnlState } from './realizedPnlStorage'

/** Full portfolio backup schema version. */
export const PORTFOLIO_BACKUP_VERSION = 1 as const

export interface PortfolioBackup {
  version: typeof PORTFOLIO_BACKUP_VERSION
  exportedAt: string
  investments: {
    version: 2
    kind: InvestmentKind
    selectedIds: {
      stock: number | null
      crypto: number | null
      bullion: number | null
    }
    entries: Record<string, StoredAssetEntry>
  }
  realizedPnl: RealizedPnlState
}

export type ImportResult =
  | {
      ok: true
      mode: 'full'
      investments: InvestmentPrefs
      realizedPnl: RealizedPnlState
    }
  | {
      ok: true
      mode: 'realized-only'
      realizedPnl: RealizedPnlState
    }
  | { ok: false; error: string }

function isKind(value: unknown): value is InvestmentKind {
  return value === 'stock' || value === 'crypto' || value === 'bullion'
}

function isEntry(value: unknown): value is StoredAssetEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.price !== 'string' || typeof v.shares !== 'string') return false
  if (v.firstPrice !== undefined && typeof v.firstPrice !== 'string') return false
  return true
}

function parseAssetMapKey(key: string): boolean {
  return /^(stock|crypto|bullion):\d+$/.test(key)
}

function parseSelectedId(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseEntries(raw: unknown): Record<string, StoredAssetEntry> | null {
  if (!raw || typeof raw !== 'object') return null
  const entries: Record<string, StoredAssetEntry> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!parseAssetMapKey(key) || !isEntry(value)) continue
    const sanitized = sanitizeStoredEntry(value)
    if (!sanitized.price.trim() && !sanitized.shares.trim()) continue
    entries[key] = sanitized
  }
  return entries
}

function parseRealizedPnl(raw: unknown): RealizedPnlState | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<RealizedPnlState>
  const byKind = {
    stock: parseAmount(parsed.byKind?.stock),
    crypto: parseAmount(parsed.byKind?.crypto),
    bullion: parseAmount(parsed.byKind?.bullion),
  }

  const byAsset: Record<string, AssetRealizedPnl> = {}
  if (parsed.byAsset && typeof parsed.byAsset === 'object') {
    for (const [key, value] of Object.entries(parsed.byAsset)) {
      if (!value || typeof value !== 'object') continue
      if (!parseAssetMapKey(key)) continue
      const realized = parseAmount((value as AssetRealizedPnl).realized)
      const sellCount = Number((value as AssetRealizedPnl).sellCount)
      const name = String((value as AssetRealizedPnl).name ?? key)
      byAsset[key] = {
        realized,
        sellCount: Number.isFinite(sellCount) ? sellCount : 0,
        name,
      }
    }
  }

  return { version: 1, byKind, byAsset }
}

function parseAmount(value: unknown): string {
  const text = String(value ?? '')
  return /^[-+]?\d+(?:\.\d{0,8})?$/.test(text)
    ? text.replace(/^\+/, '')
    : Number.isFinite(Number(value))
      ? String(Number(value))
      : '0'
}

/** Build a portable backup of positions + realized P&L. */
export function buildPortfolioBackup(
  prefs: InvestmentPrefs,
  realizedPnl: RealizedPnlState,
): PortfolioBackup {
  return {
    version: PORTFOLIO_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    investments: {
      version: 2,
      kind: prefs.kind,
      selectedIds: { ...prefs.selectedIds },
      entries: { ...prefs.entries },
    },
    realizedPnl: {
      version: 1,
      byKind: { ...realizedPnl.byKind },
      byAsset: { ...realizedPnl.byAsset },
    },
  }
}

/**
 * Parse a backup file.
 * Accepts a full portfolio backup, or a bare realized-P&L blob
 * (`{ version: 1, byKind, byAsset }`) for convenience.
 */
export function parsePortfolioBackup(raw: unknown): ImportResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Backup must be a JSON object.' }
  }

  const obj = raw as Record<string, unknown>

  // Full portfolio backup
  if ('investments' in obj || 'realizedPnl' in obj) {
    if (obj.version !== 1) {
      return { ok: false, error: 'Unsupported backup version (expected 1).' }
    }

    const inv = obj.investments
    if (!inv || typeof inv !== 'object') {
      return { ok: false, error: 'Missing investments section.' }
    }
    const invObj = inv as Record<string, unknown>
    const kind = isKind(invObj.kind) ? invObj.kind : 'stock'
    const selectedIdsRaw =
      invObj.selectedIds && typeof invObj.selectedIds === 'object'
        ? (invObj.selectedIds as Record<string, unknown>)
        : {}
    const entries = parseEntries(invObj.entries)
    if (!entries) {
      return { ok: false, error: 'Invalid investments.entries map.' }
    }

    const realizedSource = obj.realizedPnl ?? { version: 1, byKind: {}, byAsset: {} }
    const realizedPnl = parseRealizedPnl(realizedSource)
    if (!realizedPnl) {
      return { ok: false, error: 'Invalid realizedPnl section.' }
    }

    return {
      ok: true,
      mode: 'full',
      investments: {
        version: 2,
        kind,
        selectedIds: {
          stock: parseSelectedId(selectedIdsRaw.stock),
          crypto: parseSelectedId(selectedIdsRaw.crypto),
          bullion: parseSelectedId(selectedIdsRaw.bullion),
        },
        entries,
      },
      realizedPnl,
    }
  }

  // Bare realized P&L (same shape as localStorage key payload)
  if ('byKind' in obj && 'byAsset' in obj) {
    const realizedPnl = parseRealizedPnl(obj)
    if (!realizedPnl) {
      return { ok: false, error: 'Invalid realized P&L JSON.' }
    }
    return { ok: true, mode: 'realized-only', realizedPnl }
  }

  return {
    ok: false,
    error: 'Unrecognized backup format. Export from this app, or paste realized P&L JSON.',
  }
}

export function downloadPortfolioBackup(
  prefs: InvestmentPrefs,
  realizedPnl: RealizedPnlState,
): void {
  const backup = buildPortfolioBackup(prefs, realizedPnl)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = `business-empire-portfolio-${stamp}.json`
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readBackupFile(file: File): Promise<ImportResult> {
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'Could not read the selected file.' }
  }
  try {
    return parsePortfolioBackup(JSON.parse(text) as unknown)
  } catch {
    return { ok: false, error: 'File is not valid JSON.' }
  }
}
