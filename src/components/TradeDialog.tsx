import { useEffect, useId, useMemo, useRef, useState, type FocusEvent } from 'react'
import { formatMoney, formatPct, parseUserNumber } from '../data/investments'
import type { InvestmentAsset, TradeAction } from '../types'

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

/** Compact share display without ugly float tails. */
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
  onClose,
  onBuy,
  onSell,
}: {
  position: TradePosition
  onClose: () => void
  onBuy: (shares: number) => void
  onSell: (shares: number) => void
}) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<AmountMode>('shares')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<DialogStep>('edit')
  const [pendingSellShares, setPendingSellShares] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { asset, price, shares: held } = position

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
    // dollars → shares at last entered price
    return n / price
  }, [amount, mode, price])

  const resolvedCost = useMemo(() => {
    if (resolvedShares == null) return null
    return resolvedShares * price
  }, [resolvedShares, price])

  const setModeExclusive = (next: AmountMode) => {
    setMode(next)
    setAmount('')
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
    if (resolvedShares == null || resolvedShares <= 0) {
      setError(mode === 'shares' ? 'Enter how many shares to buy.' : 'Enter a dollar amount to buy.')
      return
    }
    onBuy(resolvedShares)
  }

  const requestSell = () => {
    setError(null)
    if (held <= 0) {
      setError('You have no shares to sell.')
      return
    }
    if (resolvedShares == null || resolvedShares <= 0) {
      setError(mode === 'shares' ? 'Enter how many shares to sell.' : 'Enter a dollar amount to sell.')
      return
    }

    let sharesToSell = resolvedShares
    if (sharesToSell > held + 1e-12) {
      setError(
        mode === 'shares'
          ? `You only hold ${formatShares(held)} shares.`
          : `That is about ${formatShares(sharesToSell)} shares; you only hold ${formatShares(held)}.`,
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
          <p className="trade-dialog-sub">Buy / Sell · last price {formatMoney(price)}</p>
        </header>

        <section className="trade-ticker-record" aria-label="Recorded ticker data">
          <div className="trade-record-grid">
            <div>
              <span className="trade-record-label">First price</span>
              <span className="trade-record-value">{formatMoney(position.firstPrice)}</span>
            </div>
            <div>
              <span className="trade-record-label">Last price</span>
              <span className="trade-record-value">{formatMoney(position.price)}</span>
            </div>
            <div>
              <span className="trade-record-label">Shares held</span>
              <span className="trade-record-value">{formatShares(position.shares)}</span>
            </div>
            <div>
              <span className="trade-record-label">Total inv.</span>
              <span className="trade-record-value">{formatMoney(position.totalInvestment)}</span>
            </div>
            <div>
              <span className="trade-record-label">Gain / loss</span>
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
                Number of shares
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
                  {mode === 'shares' ? 'Shares' : 'Dollar amount'}
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
                <div className="stat-hint" style={{ marginTop: '0.35rem' }}>
                  ≈ <strong>{formatShares(resolvedShares)}</strong> shares ·{' '}
                  {formatMoney(resolvedCost ?? 0)} at {formatMoney(price)}
                </div>
              )}
              {resolvedShares != null && mode === 'shares' && (
                <div className="stat-hint" style={{ marginTop: '0.35rem' }}>
                  ≈ <strong>{formatMoney(resolvedCost ?? 0)}</strong> at {formatMoney(price)}
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
              <strong className="pot-down">{formatShares(pendingSellShares ?? 0)}</strong> shares
              of <strong>{asset.name}</strong> at <strong>{formatMoney(price)}</strong>.
            </p>
            <ul className="trade-confirm-list">
              <li>
                Dollar amount entered:{' '}
                <strong>{formatMoney(parseUserNumber(amount) ?? 0)}</strong>
              </li>
              <li>
                Proceeds ≈{' '}
                <strong>{formatMoney((pendingSellShares ?? 0) * price)}</strong>
              </li>
              <li>
                Shares remaining:{' '}
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
