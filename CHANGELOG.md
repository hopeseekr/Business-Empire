## v1.5.0

* **[2026-07-29 13:38:38 EEST]** NFT buy spends liquid ETH/TRB; sell returns fixed coin prices to the bag.
* **[2026-07-29 08:02:01 EEST]** Add Playwright as an e2e test runner
* **[2026-07-29 05:34:16 EEST]** Make total invested editable for precise price calculation
* **[2026-07-29 05:27:15 EEST]** Use exact fixed-point accounting for investment trades.
* **[2026-07-29 05:16:31 EEST]** Added observed data for gold and silver bullion.
* **[2026-07-29 05:11:30 EEST]** Cleaned up the clothing brands data.

## v1.4.0

* **[2026-07-28 11:21:55 EEST]** Replace the average metric with distance from minimum.
* **[2026-07-28 11:08:58 EEST]** Prioritize owned investments in the Bulk Screener.
* **[2026-07-28 11:03:13 EEST]** Make Bulk Screener comparison columns sortable.
* **[2026-07-28 10:58:51 EEST]** Default the Bulk Screener to descending yield.
* **[2026-07-28 10:38:25 EEST]** Add a sortable Yield column to the Bulk Screening stocks tab.
* **[2026-07-28 10:32:13 EEST]** Add Bulk Screening for rapid whole-market price entry.
* **[2026-07-28 10:07:08 EEST]** Add AGENTS.md requiring auto-commit after each feature.
* **[2026-07-28 10:06:45 EEST]** Remove static potential field from investment JSON.
* **[2026-07-28 10:05:10 EEST]** Rename stock max_gain to yield and add outstanding shares.
* **[2026-07-28 09:59:12 EEST]** Recalculate stock averages as midpoint of min and max.
* **[2026-07-28 02:03:12 EEST]** Updated the stocks min/max based on latest research.

## v1.3.0

* **[2026-07-27 17:08:39 EEST]** Lower Viza stock min range to $183.47.
* **[2026-07-27 17:07:32 EEST]** Add Bullion category with Gold, Silver, and Diamonds.
* **[2026-07-27 13:37:24 EEST]** Show full stock, crypto, and clothing match lists.
* **[2026-07-27 11:57:27 EEST]** Add portfolio Export/Import for positions and realized P&L.
* **[2026-07-27 11:57:21 EEST]** Persist realized P&L in localStorage instead of sessionStorage.

## v1.2.0

* **[2026-07-27 07:17:12 EEST]** Use coins wording for crypto in trade UI.
* **[2026-07-27 07:16:58 EEST]** Make last price editable in the trade dialog.
* **[2026-07-27 07:16:11 EEST]** Use mark-to-market value for total investment.
* **[2026-07-27 06:31:42 EEST]** Copy share equivalent when switching from dollar mode.
* **[2026-07-27 06:31:32 EEST]** Improve trade dialog conversion hint readability.
* **[2026-07-27 05:40:09 EEST]** Require trade dialog for share changes.
* **[2026-07-27 05:37:43 EEST]** Added Cost Basis calculation.
* **[2026-07-27 05:35:03 EEST]** Fixes for First Price recording.

## v1.1.0

* **[2026-07-27 04:48:17 EEST]** Track session realized P&L by market and ticker.
* **[2026-07-27 04:42:31 EEST]** Add BUY/SELL trade dialog from action chips and verdict.
* **[2026-07-27 04:38:09 EEST]** Track first entered price and show ledger gain/loss.
* **[2026-07-27 04:35:06 EEST]** Add compact owned-assets table on Investments.
* **[2026-07-27 04:33:14 EEST]** Credit Grok AI and Grok Build in README and site footer.
* **[2026-07-27 04:32:16 EEST]** Persist investment price and shares in localStorage.
* **[2026-07-27 04:29:39 EEST]** Removed unnecessary verbage on the Investments page.
* **[2026-07-27 04:29:23 EEST]** [m] Added a release script.
* **[2026-07-27 04:28:47 EEST]** Minify sidebar on Investments and Clothing pages.

## v1.0.0

* **[2026-07-27 04:19:43 EEST]** [m] Added proper license info.
* **[2026-07-27 04:18:38 EEST]** [m] Added the link to the prod instance.
* **[2026-07-27 04:18:18 EEST]** Migrated to HashRouter to avoid 500 INTERNAL ERRORs.
* **[2026-07-27 04:13:40 EEST]** feat(inputs): limit investment entries to decimals
* **[2026-07-27 04:08:59 EEST]** fix(a11y): preserve table semantics for selection
* **[2026-07-27 04:07:10 EEST]** feat(a11y): support keyboard table selection
* **[2026-07-27 04:02:54 EEST]** Initial.
