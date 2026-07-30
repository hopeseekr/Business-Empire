import { test, expect } from '@playwright/test'
import {
  buyUnits,
  expectPortfolio,
  gotoCleanInvestments,
  openTradeAtPrice,
  openTradeDialog,
  portfolioRow,
  sellAllUnits,
  sellDollars,
  setLivePrice,
} from './investments-helpers'

/**
 * Portfolio accounting runs on a signed lifetime cash ledger: Relative Cost Basis is
 * cumulative purchase costs minus every sale proceed, and Net P&L is market value
 * minus that basis minus the profit already banked this round. A sale pays out
 * available profit first and treats the rest as returned capital, so harvesting a
 * gain drops Net P&L to zero instead of inventing profit on money that was only
 * ever principal. See src/data/fixedPoint.ts (allocateSaleProceeds).
 */

test.describe('Portfolio relative ledger', () => {
  test('harvesting a gain books profit and zeroes Net P&L', async ({ page }) => {
    await gotoCleanInvestments(page)

    // $40M in: 1,000,000 shares at $40.
    await openTradeDialog(page, 'AD&D', '40')
    await buyUnits(page, '1000000')

    const row = portfolioRow(page, 'AD&D')
    await expectPortfolio(row, {
      relCostBasis: '$40.00',
      totalInvested: '$40,000,000.00',
      netPnl: '$0.00',
      realized: '$0.00',
    })

    // Position appreciates to $42M — $2M of profit is now available.
    await setLivePrice(page, '42')
    await expectPortfolio(row, {
      relCostBasis: '$40.00',
      totalInvested: '$42,000,000.00',
      netPnl: '$2,000,000.00',
    })
    await expect(row.locator('td').nth(3)).toContainText('+5.00%')

    // Take exactly the $2M of profit off the table.
    await openTradeAtPrice(page, '42')
    await sellDollars(page, '2000000')

    // All $2M lands in the trader log; the remaining $40M is principal, so the
    // relative basis spreads over fewer shares and Net P&L is flat again.
    await expectPortfolio(row, {
      relCostBasis: '$39.90',
      totalInvested: '$40,000,000.00',
      netPnl: '$0.00',
      realized: '+$2,000,000.00',
    })
  })

  test('selling underwater realizes nothing and raises per-share cost', async ({ page }) => {
    await gotoCleanInvestments(page)

    await openTradeDialog(page, 'AD&D', '40')
    await buyUnits(page, '1000000')

    // Position falls to $35M.
    await setLivePrice(page, '35')
    const row = portfolioRow(page, 'AD&D')
    await expectPortfolio(row, {
      relCostBasis: '$40.00',
      totalInvested: '$35,000,000.00',
      netPnl: '-$5,000,000.00',
    })

    // Pulling $2M out of a losing position returns capital — it is not a gain.
    await openTradeAtPrice(page, '35')
    await sellDollars(page, '2000000')

    await expectPortfolio(row, {
      relCostBasis: '$40.30',
      totalInvested: '$33,000,000.00',
      netPnl: '-$5,000,000.00',
      realized: '$0.00',
    })
  })

  test('liquidating underwater books the shortfall as a realized loss', async ({ page }) => {
    await gotoCleanInvestments(page)

    await openTradeDialog(page, 'AD&D', '40')
    await buyUnits(page, '1000000')
    await setLivePrice(page, '35')

    // A full exit has no position left to carry the unrecovered $5M, so it closes.
    await openTradeAtPrice(page, '35')
    await sellAllUnits(page)

    await expect(portfolioRow(page, 'AD&D')).toHaveCount(0)
    await expect(page.locator('.card', { hasText: 'Realized P&L' }).first()).toContainText(
      '5,000,000.00',
    )
  })

  test('re-entry after liquidation starts from a clean ledger', async ({ page }) => {
    await gotoCleanInvestments(page)

    // Round one: harvest $2M of profit, then exit completely.
    await openTradeDialog(page, 'AD&D', '40')
    await buyUnits(page, '1000000')
    await setLivePrice(page, '42')
    await openTradeAtPrice(page, '42')
    await sellDollars(page, '2000000')
    await openTradeAtPrice(page, '42')
    await sellAllUnits(page)
    await expect(portfolioRow(page, 'AD&D')).toHaveCount(0)

    // Reload first: a liquidated ledger must not come back from localStorage.
    await page.reload()
    await expect(portfolioRow(page, 'AD&D')).toHaveCount(0)

    // Round two opens fresh: banked profit stays in the lifetime trader log, but it
    // must not bleed into the new position's Relative Cost Basis or Net P&L.
    await openTradeDialog(page, 'AD&D', '30')
    await buyUnits(page, '100000')

    const row = portfolioRow(page, 'AD&D')
    await expectPortfolio(row, {
      relCostBasis: '$30.00',
      totalInvested: '$3,000,000.00',
      netPnl: '$0.00',
      realized: '+$2,000,000.00',
    })
  })

  test('the ledger survives a reload', async ({ page }) => {
    await gotoCleanInvestments(page)

    await openTradeDialog(page, 'AD&D', '40')
    await buyUnits(page, '1000000')
    await setLivePrice(page, '42')
    await openTradeAtPrice(page, '42')
    await sellDollars(page, '2000000')

    await page.reload()

    await expectPortfolio(portfolioRow(page, 'AD&D'), {
      relCostBasis: '$39.90',
      totalInvested: '$40,000,000.00',
      netPnl: '$0.00',
      realized: '+$2,000,000.00',
    })
  })
})
