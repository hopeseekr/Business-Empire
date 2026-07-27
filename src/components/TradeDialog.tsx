import { useEffect, useId, useMemo, useRef, useState, type FocusEvent } from 'react'
import { formatMoney, formatPct, parseUserNumber } from '../data/investments'
import { formatSignedMoney } from '../data/realizedPnlStorage'
import type { InvestmentAsset, InvestmentKind, InvestmentUnit, TradeAction } from '../types'

export interface TradePosition {
  asset: InvestmentAsset
  price: number
  firstPrice: number
  shares: number
  totalInvestment: number
  gainLoss: number
  gainLossPct: number
  maxPotential: number
  potentialPct: number
  action: TradeAction
}

type AmountMode = 'shares' | 'dollars'
type DialogStep = 'edit' | 'sell-confirm'

const UNIT_LABELS: Record<
  InvestmentUnit,
  { singular: string; plural: string; title: string }
> = {
  share: { singular: 'share', plural: 'shares', title: 'Shares' },
  coin: { singular: 'coin', plural: 'coins', title: 'Coins' },
  ingot: { singular: 'ingot', plural: 'ingots', title: 'Ingots' },
  carat: { singular: 'carat', plural: 'carats', title: 'Carats' },
}

/** Default unit when only the market kind is known (no specific asset). */
export function defaultUnitForKind(kind: InvestmentKind): InvestmentUnit {
  if (kind === 'crypto') return 'coin'
  if (kind === 'bullion') return 'ingot'
  return 'share'
}

/**
 * User-facing quantity unit.
 * Pass an asset for per-ticker units (e.g. bullion: Gold/Silver = ingots, Diamonds = carats),
 * or a kind for generic copy (bullion defaults to ingots).
 */
export function unitWord(
  source: InvestmentAsset | InvestmentKind,
  form: 'singular' | 'plural' | 'title' = 'plural',
): string {
  const unit: InvestmentUnit =
    typeof source === 'string' ? defaultUnitForKind(source) : source.unit
  const labels = UNIT_LABELS[unit]
  if (form === 'singular') return labels.singular
  if (form === 'title') return labels.title
  return labels.plural
}

function sanitizeDecimalInput(value: string): string {
  let result = ''
  let hasDecimal = false
  for (const character of value) {
    if (/\d/.test(character)) {
      result += character
    } else if (character === '.' && !hasDecimal) {
      result += character
      hasDecimal = true
    }
  }
  return result
}

/** Compact share/coin quantity display without ugly float tails. */
export function formatShares(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n))
  const fixed = n.toFixed(8).replace(/\.?0+$/, '')
  return fixed
}

function actionClass(action: TradeAction): string {
  if (action === 'BUY') return 'action-buy'
  if (action === 'SELL') return 'action-sell'
  return 'action-hold'
}

function selectAllOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.select()
}

export function TradeDialog({
  position,
  priceText,
  sessionRealized = 0,
  onClose,
  onBuy,
  onSell,
  onPriceChange,
  onPriceBlur,
}: {
  position: TradePosition
  /** Editable last/current price string — same value as the main Trade helper field. */
  priceText: string
  /** Cumulative realized P&L for this ticker (localStorage). */
  sessionRealized?: number
  onClose: () => void
  onBuy: (shares: number) => void
  onSell: (shares: number) => void
  onPriceChange: (value: string) => void
  onPriceBlur?: () => void
}) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<AmountMode>('shares')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<DialogStep>('edit')
  const [pendingSellShares, setPendingSellShares] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { asset, shares: held } = position
  const units = unitWord(asset, 'plural')
  const unitsTitle = unitWord(asset, 'title')

  /** Live price from the editable field (drives conversions + fills). */
  const price = useMemo(() => {
    const n = parseUserNumber(priceText)
    return n != null && n > 0 ? n : 0
  }, [priceText])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (step === 'sell-confirm') {
          setStep('edit')
          setPendingSellShares(null)
          setError(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  useEffect(() => {
    // Focus amount field when opening / returning to edit.
    if (step === 'edit') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [step, mode])

  const resolvedShares = useMemo(() => {
    const n = parseUserNumber(amount)
    if (n == null || n <= 0) return null
    if (mode === 'shares') return n
    if (!(price > 0)) return null
    // dollars → shares at last entered price
    return n / price
  }, [amount, mode, price])

  const resolvedCost = useMemo(() => {
    if (resolvedShares == null || !(price > 0)) return null
    return resolvedShares * price
  }, [resolvedShares, price])

  const setModeExclusive = (next: AmountMode) => {
    // Dollars → shares: carry over the equivalent share count into the input.
    // Shares → dollars (or empty dollar amount): clear the field.
    if (next === 'shares' && mode === 'dollars') {
      const dollars = parseUserNumber(amount)
      if (dollars != null && dollars > 0 && price > 0) {
        setAmount(formatShares(dollars / price))
      } else {
        setAmount('')
      }
    } else {
      setAmount('')
    }
    setMode(next)
    setError(null)
    setStep('edit')
    setPendingSellShares(null)
  }

  const fillAllShares = () => {
    setMode('shares')
    setAmount(formatShares(held))
    setError(null)
    setStep('edit')
    setPendingSellShares(null)
  }

  const requestBuy = () => {
    setError(null)
    if (!(price > 0)) {
      setError('Enter a valid last price greater than 0.')
      return
    }
    if (resolvedShares == null || resolvedShares <= 0) {
      setError(
        mode === 'shares'
          ? `Enter how many ${units} to buy.`
          : 'Enter a dollar amount to buy.',
      )
      return
    }
    onBuy(resolvedShares)
  }

  const requestSell = () => {
    setError(null)
    if (!(price > 0)) {
      setError('Enter a valid last price greater than 0.')
      return
    }
    if (held <= 0) {
      setError(`You have no ${units} to sell.`)
      return
    }
    if (resolvedShares == null || resolvedShares <= 0) {
      setError(
        mode === 'shares'
          ? `Enter how many ${units} to sell.`
          : 'Enter a dollar amount to sell.',
      )
      return
    }

    let sharesToSell = resolvedShares
    if (sharesToSell > held + 1e-12) {
      setError(
        mode === 'shares'
          ? `You only hold ${formatShares(held)} ${units}.`
          : `That is about ${formatShares(sharesToSell)} ${units}; you only hold ${formatShares(held)}.`,
      )
      return
    }
    // Snap tiny float overshoot to full position.
    if (Math.abs(sharesToSell - held) < 1e-9 || sharesToSell > held) {
      sharesToSell = held
    }

    if (mode === 'dollars') {
      setPendingSellShares(sharesToSell)
      setStep('sell-confirm')
      return
    }

    onSell(sharesToSell)
  }

  const confirmDollarSell = () => {
    if (pendingSellShares == null || pendingSellShares <= 0) return
    onSell(pendingSellShares)
  }

  return (
    <div
      className="trade-dialog-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="trade-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="trade-dialog-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <header className="trade-dialog-header">
          <h2 id={titleId} className="trade-dialog-title">
            {asset.name}
          </h2>
          <p className="trade-dialog-sub">
            Buy / Sell · last price {price > 0 ? formatMoney(price) : '—'}
          </p>
        </header>

        <section className="trade-ticker-record" aria-label="Recorded ticker data">
          <div className="trade-record-grid">
            <div>
              <span className="trade-record-label">Cost basis</span>
              <span className="trade-record-value">{formatMoney(position.firstPrice)}</span>
            </div>
            <div>
              <label className="trade-record-label" htmlFor="trade-last-price">
                Last price
              </label>
              <input
                id="trade-last-price"
                className="input trade-price-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 1247.85"
                value={priceText}
                onChange={(e) => {
                  onPriceChange(sanitizeDecimalInput(e.target.value))
                  setError(null)
                }}
                onFocus={selectAllOnFocus}
                onBlur={onPriceBlur}
                aria-label="Last price"
              />
            </div>
            <div>
              <span className="trade-record-label">{unitsTitle} held</span>
              <span className="trade-record-value">{formatShares(position.shares)}</span>
            </div>
            <div>
              <span className="trade-record-label">Total inv.</span>
              <span className="trade-record-value">{formatMoney(position.totalInvestment)}</span>
            </div>
            <div>
              <span className="trade-record-label">Unrealized</span>
              <span
                className={`trade-record-value ${
                  position.gainLoss > 0 ? 'pot-up' : position.gainLoss < 0 ? 'pot-down' : ''
                }`}
              >
                {formatMoney(position.gainLoss)}{' '}
                <span className="pot-pct">({formatPct(position.gainLossPct)})</span>
              </span>
            </div>
            <div>
              <span className="trade-record-label">Realized P&amp;L</span>
              <span
                className={`trade-record-value ${
                  sessionRealized > 0 ? 'pot-up' : sessionRealized < 0 ? 'pot-down' : ''
                }`}
              >
                {formatSignedMoney(sessionRealized)}
              </span>
            </div>
            <div>
              <span className="trade-record-label">Max potential</span>
              <span
                className={`trade-record-value ${
                  position.maxPotential >= 0 ? 'pot-up' : 'pot-down'
                }`}
              >
                {formatMoney(position.maxPotential)}{' '}
                <span className="pot-pct">({formatPct(position.potentialPct)})</span>
              </span>
            </div>
            <div>
              <span className="trade-record-label">Range min / avg / max</span>
              <span className="trade-record-value trade-record-range">
                {formatMoney(asset.min)} · {formatMoney(asset.average)} · {formatMoney(asset.max)}
              </span>
            </div>
            <div>
              <span className="trade-record-label">Signal</span>
              <span className="trade-record-value">
                <span className={`action-chip ${actionClass(position.action)}`}>
                  {position.action}
                </span>
              </span>
            </div>
          </div>
        </section>

        {step === 'edit' ? (
          <>
            <div className="trade-mode-toggle" role="radiogroup" aria-label="Order size mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'shares'}
                className={mode === 'shares' ? 'active' : undefined}
                onClick={() => setModeExclusive('shares')}
              >
                Number of {units}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'dollars'}
                className={mode === 'dollars' ? 'active' : undefined}
                onClick={() => setModeExclusive('dollars')}
              >
                $ Dollar amount
              </button>
            </div>

            <div className="field trade-amount-field">
              <div className="row" style={{ marginBottom: '0.35rem' }}>
                <label className="field-label" htmlFor="trade-amount" style={{ margin: 0 }}>
                  {mode === 'shares' ? unitsTitle : 'Dollar amount'}
                </label>
                {mode === 'shares' && (
                  <button type="button" className="trade-all-btn" onClick={fillAllShares}>
                    ALL ({formatShares(held)})
                  </button>
                )}
              </div>
              <input
                id="trade-amount"
                ref={inputRef}
                className="input input-lg"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={mode === 'shares' ? 'e.g. 10' : 'e.g. 500'}
                value={amount}
                onChange={(e) => {
                  setAmount(sanitizeDecimalInput(e.target.value))
                  setError(null)
                }}
                onFocus={selectAllOnFocus}
              />
              {resolvedShares != null && mode === 'dollars' && (
                <div className="trade-amount-equiv">
                  ≈{' '}
                  <span className="trade-amount-equiv-num trade-amount-equiv-num-primary">
                    {formatShares(resolvedShares)}
                  </span>{' '}
                  {units} ·{' '}
                  <span className="trade-amount-equiv-num trade-amount-equiv-num-secondary">
                    {formatMoney(resolvedCost ?? 0)}
                  </span>{' '}
                  at{' '}
                  <span className="trade-amount-equiv-num trade-amount-equiv-num-primary">
                    {formatMoney(price)}
                  </span>
                </div>
              )}
              {resolvedShares != null && mode === 'shares' && (
                <div className="trade-amount-equiv">
                  ≈{' '}
                  <span className="trade-amount-equiv-num trade-amount-equiv-num-primary">
                    {formatMoney(resolvedCost ?? 0)}
                  </span>{' '}
                  at{' '}
                  <span className="trade-amount-equiv-num trade-amount-equiv-num-secondary">
                    {formatMoney(price)}
                  </span>
                </div>
              )}
              {error && <div className="field-error">{error}</div>}
            </div>

            <div className="trade-actions">
              <button type="button" className="trade-btn trade-btn-buy" onClick={requestBuy}>
                BUY
              </button>
              <button type="button" className="trade-btn trade-btn-sell" onClick={requestSell}>
                SELL
              </button>
            </div>
          </>
        ) : (
          <section className="trade-sell-confirm" aria-label="Confirm sell">
            <h3 className="trade-confirm-title">Confirm SELL</h3>
            <p className="trade-confirm-body">
              Sell exactly{' '}
              <strong className="pot-down">{formatShares(pendingSellShares ?? 0)}</strong> {units}{' '}
              of <strong>{asset.name}</strong> at{' '}
              <strong>{price > 0 ? formatMoney(price) : '—'}</strong>.
            </p>
            <ul className="trade-confirm-list">
              <li>
                Dollar amount entered:{' '}
                <strong>{formatMoney(parseUserNumber(amount) ?? 0)}</strong>
              </li>
              <li>
                Proceeds ≈{' '}
                <strong>
                  {price > 0
                    ? formatMoney((pendingSellShares ?? 0) * price)
                    : '—'}
                </strong>
              </li>
              <li>
                {unitsTitle} remaining:{' '}
                <strong>{formatShares(Math.max(0, held - (pendingSellShares ?? 0)))}</strong>
              </li>
            </ul>
            {error && <div className="field-error">{error}</div>}
            <div className="trade-actions">
              <button
                type="button"
                className="trade-btn trade-btn-back"
                onClick={() => {
                  setStep('edit')
                  setPendingSellShares(null)
                  setError(null)
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="trade-btn trade-btn-sell"
                onClick={confirmDollarSell}
              >
                Confirm SELL
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
