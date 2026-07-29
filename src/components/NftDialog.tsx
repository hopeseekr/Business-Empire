import { useState } from 'react'
import { formatMoney } from '../data/investments'
import type { NftCurrency, NftDefinition } from '../data/nfts'

export function NftDialog({ currency, options, owned, cryptoPrice, onBuy, onClose }: { currency: NftCurrency; options: NftDefinition[]; owned: string[]; cryptoPrice: number; onBuy: (name: string) => void; onClose: () => void }) {
  const [selected, setSelected] = useState(options.find((n) => !owned.includes(n.name))?.name || options[0].name)
  const nft = options.find((n) => n.name === selected)!
  return <div className="trade-dialog-overlay" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="trade-dialog" role="dialog" aria-modal="true" aria-label="Buy NFT">
      <button type="button" className="trade-dialog-close" onClick={onClose} aria-label="Close">×</button>
      <header className="trade-dialog-header"><h2 className="trade-dialog-title">Buy NFT</h2><p className="trade-dialog-sub">{currency} collection · current {formatMoney(cryptoPrice)} {currency}</p></header>
      <div className="field"><label className="field-label" htmlFor="nft-select">NFT</label><select id="nft-select" className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>{options.map((item) => <option key={item.name} value={item.name} disabled={owned.includes(item.name)}>{item.name} — {item.price.toLocaleString()} {currency}{owned.includes(item.name) ? ' (owned)' : ''}</option>)}</select></div>
      <section className="trade-ticker-record"><div className="trade-record-grid"><div><span className="trade-record-label">Fixed price</span><span className="trade-record-value">{nft.price.toLocaleString()} {currency}</span></div><div><span className="trade-record-label">Floating value</span><span className="trade-record-value pot-up">{formatMoney(nft.price * cryptoPrice)}</span></div></div></section>
      <div className="trade-actions"><button type="button" className="trade-btn trade-btn-buy" disabled={owned.includes(nft.name)} onClick={() => onBuy(nft.name)}>BUY NFT</button></div>
    </div>
  </div>
}
