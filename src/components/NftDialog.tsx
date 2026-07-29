import { useState } from 'react'
import { formatMoney } from '../data/investments'
import type { NftCurrency, NftDefinition } from '../data/nfts'

export function NftDialog({ currency, options, owned, cryptoPrice, onBuy, onClose }: { currency: NftCurrency; options: NftDefinition[]; owned: string[]; cryptoPrice: number; onBuy: (names: string[]) => void; onClose: () => void }) {
  const [checked, setChecked] = useState<string[]>([])
  const available = options.filter((item) => !owned.includes(item.name))
  const selectedTotal = options.filter((item) => checked.includes(item.name)).reduce((sum, item) => sum + item.price, 0)
  return <div className="trade-dialog-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="trade-dialog" role="dialog" aria-modal="true" aria-label="Buy NFT">
      <button type="button" className="trade-dialog-close" onClick={onClose} aria-label="Close">×</button>
      <header className="trade-dialog-header"><h2 className="trade-dialog-title">Buy NFT</h2><p className="trade-dialog-sub">{currency} collection · current {formatMoney(cryptoPrice)} {currency}</p></header>
      <div className={`nft-picker nft-picker-${currency}`} aria-label={`${currency} NFTs`}>
        {options.map((item) => {
          const isOwned = owned.includes(item.name)
          const isChecked = isOwned || checked.includes(item.name)
          return <label className={`nft-option${isOwned ? ' owned' : ''}`} key={item.name}>
            <input type="checkbox" checked={isChecked} disabled={isOwned} onChange={() => setChecked((prev) => prev.includes(item.name) ? prev.filter((name) => name !== item.name) : [...prev, item.name])} />
            <span className="nft-option-copy"><strong>{item.name}</strong><small>{item.price.toLocaleString()} {currency} · {cryptoPrice > 0 ? formatMoney(item.price * cryptoPrice) : '—'} floating</small></span>
          </label>
        })}
      </div>
      <section className="trade-ticker-record"><div className="trade-record-grid"><div><span className="trade-record-label">Selected NFTs</span><span className="trade-record-value">{checked.length}</span></div><div><span className="trade-record-label">Real investment</span><span className="trade-record-value">{selectedTotal.toLocaleString()} {currency}</span></div></div></section>
      <div className="trade-actions"><button type="button" className="trade-btn trade-btn-buy" disabled={checked.length === 0 || available.length === 0} onClick={() => onBuy(checked)}>BUY {checked.length || ''} NFT{checked.length === 1 ? '' : 's'}</button></div>
    </div>
  </div>
}
