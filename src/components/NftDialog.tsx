import { useState } from 'react'
import type { NftCurrency, NftDefinition } from '../data/nfts'
import { nftTotalPrice } from '../data/nfts'

export function NftDialog({
  currency,
  options,
  owned,
  availableCoins,
  onBuy,
  onSell,
  onClose,
}: {
  currency: NftCurrency
  options: NftDefinition[]
  owned: string[]
  /** Liquid coins currently held (same units as NFT prices). */
  availableCoins: number
  onBuy: (names: string[]) => string | null
  onSell: (names: string[]) => string | null
  onClose: () => void
}) {
  const [toBuy, setToBuy] = useState<string[]>([])
  const [toSell, setToSell] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const available = options.filter((item) => !owned.includes(item.name))
  const ownedItems = options.filter((item) => owned.includes(item.name))
  const buyTotal = nftTotalPrice(currency, toBuy)
  const sellTotal = nftTotalPrice(currency, toSell)
  const canAfford = buyTotal > 0 && buyTotal <= availableCoins

  const toggleBuy = (name: string) => {
    setError(null)
    setToBuy((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    )
  }

  const toggleSell = (name: string) => {
    setError(null)
    setToSell((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    )
  }

  const handleBuy = () => {
    const err = onBuy(toBuy)
    if (err) {
      setError(err)
      return
    }
    setToBuy([])
  }

  const handleSell = () => {
    const err = onSell(toSell)
    if (err) {
      setError(err)
      return
    }
    setToSell([])
  }

  return (
    <div
      className="trade-dialog-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="trade-dialog" role="dialog" aria-modal="true" aria-label="Trade NFT">
        <button type="button" className="trade-dialog-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <header className="trade-dialog-header">
          <h2 className="trade-dialog-title">Trade NFT</h2>
          <p className="trade-dialog-sub">
            {currency} collection · fixed prices · buy spends coins, sell returns them
          </p>
        </header>

        <section className="trade-ticker-record" style={{ marginBottom: '0.75rem' }}>
          <div className="trade-record-grid">
            <div>
              <span className="trade-record-label">Liquid {currency}</span>
              <span className="trade-record-value">
                {availableCoins.toLocaleString()} {currency}
              </span>
            </div>
            <div>
              <span className="trade-record-label">Owned NFTs</span>
              <span className="trade-record-value">{ownedItems.length}</span>
            </div>
          </div>
        </section>

        {available.length > 0 && (
          <>
            <h3 className="nft-dialog-section-title">Buy</h3>
            <div className={`nft-picker nft-picker-${currency}`} aria-label={`${currency} NFTs for sale`}>
              {available.map((item) => {
                const isChecked = toBuy.includes(item.name)
                return (
                  <label className="nft-option" key={item.name}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleBuy(item.name)}
                    />
                    <span className="nft-option-copy">
                      <strong>{item.name}</strong>
                      <small>
                        {item.price.toLocaleString()} {currency}
                      </small>
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        )}

        {ownedItems.length > 0 && (
          <>
            <h3 className="nft-dialog-section-title">Sell (owned)</h3>
            <div
              className={`nft-picker nft-picker-${currency}`}
              aria-label={`Owned ${currency} NFTs`}
            >
              {ownedItems.map((item) => {
                const isChecked = toSell.includes(item.name)
                return (
                  <label className="nft-option owned-sellable" key={item.name}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSell(item.name)}
                    />
                    <span className="nft-option-copy">
                      <strong>{item.name}</strong>
                      <small>
                        {item.price.toLocaleString()} {currency}
                      </small>
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        )}

        {available.length === 0 && ownedItems.length === 0 && (
          <p className="nft-empty">No NFTs available.</p>
        )}

        <section className="trade-ticker-record">
          <div className="trade-record-grid">
            <div>
              <span className="trade-record-label">Buy cost</span>
              <span className="trade-record-value">
                {buyTotal.toLocaleString()} {currency}
              </span>
            </div>
            <div>
              <span className="trade-record-label">Sell proceeds</span>
              <span className="trade-record-value">
                {sellTotal.toLocaleString()} {currency}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <p className="field-error" role="alert" style={{ marginTop: '0.65rem' }}>
            {error}
          </p>
        )}
        {toBuy.length > 0 && !canAfford && (
          <p className="field-error" role="status" style={{ marginTop: '0.65rem' }}>
            Need {buyTotal.toLocaleString()} {currency}; you hold{' '}
            {availableCoins.toLocaleString()}.
          </p>
        )}

        <div className="trade-actions">
          <button
            type="button"
            className="trade-btn trade-btn-buy"
            disabled={toBuy.length === 0 || !canAfford}
            onClick={handleBuy}
          >
            BUY {toBuy.length || ''} NFT{toBuy.length === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            className="trade-btn trade-btn-sell"
            disabled={toSell.length === 0}
            onClick={handleSell}
          >
            SELL {toSell.length || ''} NFT{toSell.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
