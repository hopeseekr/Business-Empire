# Business Empire: RichMan Companion

A browser companion for **Business Empire: RichMan**. It is a lookup and record-keeping tool for players; it does not connect to the game account or predict the market.

Live site: <https://ai.autonomo.codes/business-empire/>

## Player guide

### Clothing Brand

- **Launch Helper**: enter a collection name to look up its Style, Quality, Price, and Audience.
- **Collections**: search and filter all 58 known collections and inspect their launch attributes and notes.
- **Overview**: review launch rules and the upgrade path. The app uses bundled reference values, so check your game before spending.

### Investments and portfolio

The Investments screen covers 50 stocks, 13 crypto assets, and 3 bullion assets. Enter a current price and (optionally) units held to see the historical range, potential remaining to the recorded maximum, and a trade helper. BUY/SELL actions open the trade dialog, which updates your local position, average cost, and realized P&L.

**Bulk Screening** lets you enter prices for the whole list in one keyboard pass (Enter/Tab advances). It shows distance from the recorded minimum, potential to maximum, and a sortable BUY/HOLD/SELL table; stocks start sorted by yield.

The heuristic is exactly: **price below the historical average → BUY; price at or above the average while you hold units → SELL; price at or above the average with no position → HOLD**. “Potential” is `(historical max − current price) / current price`; “From min” is `(current price − historical min) / historical min`. These are comparisons to the app’s historical range, not forecasts or financial advice, and you should verify prices and make your own decisions.

### NFTs

In the crypto rows, open **NFTs → Trade** to buy or sell the listed ETH and TRB collectibles. NFT purchases move coins from your liquid balance into owned NFTs; sales return their fixed listed coin prices. The app includes 16 ETH and 5 TRB definitions.

### Saving and backups

Positions, prices, trades, realized P&L, NFT ownership, and UI selections are saved only in this browser’s `localStorage`. There is no server account or cloud sync. Use **Export** on the Investments page to download a JSON backup, and **Import** to restore it (an import replaces the current local portfolio). Keep backups when changing browsers or clearing site data, and treat backup files as private portfolio records.

## Common workflows

1. Open Clothing → Launch Helper and type a collection name before launching it in-game.
2. Open Investments, choose Stocks, Crypto, or Bullion, enter the current price, and use the range and verdict as a quick reference.
3. For a market-wide check, choose Bulk Screening and tab through the prices.
4. Record buys and sells in the trade dialog so average cost and realized P&L stay accurate.
5. Export a portfolio backup periodically; import that file after moving to another browser.

## For technical users

Requirements: Node.js 18+ (20+ recommended) and npm 9+.

```bash
npm install
npm run dev       # Vite development server, usually http://localhost:5173/
npm run build     # tsc --noEmit, then production build
npm run preview   # preview the build locally
```

The stack is React 19, TypeScript, Vite 6, and React Router 7. The app uses `HashRouter`; routes are `/`, `/clothing`, `/clothing/launch`, `/clothing/collections`, `/investments`, and `/investments/screening` (under `#/` on the live site). `vite.config.ts` sets the base to `/business-empire/` and writes the deployable webroot to `public/`; publish that directory at the subpath. No server-side SPA fallback is needed for hash routes.

Source range data is in `src/data/investments-*.json`; clothing data is in `src/data/clothing_collections.json`. The root Markdown files are human-readable source tables.

## License and attribution

Licensed under [Creative Commons Attribution-NoDerivatives 4.0 International](https://creativecommons.org/licenses/by-nd/4.0/) (see [LICENSE.md](LICENSE.md)). Not affiliated with the developers of Business Empire: RichMan. The companion was largely created with [Grok](https://grok.com) via [Grok Build](https://x.ai/cli).
