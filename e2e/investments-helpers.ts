import { expect, type Locator, type Page } from '@playwright/test'

export async function gotoCleanInvestments(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/#/investments')
}

/**
 * Select an asset, set its live price, and open the Buy/Sell dialog from the verdict.
 * Targets the picker button by role: once a position exists the ticker also appears in
 * the verdict banner and the Portfolio row.
 */
export async function openTradeDialog(page: Page, assetName: string, price: string) {
  await page.getByRole('button', { name: assetName, exact: true }).click()
  await setLivePrice(page, price)
  await openTradeAtPrice(page, price)
}

/** Re-open the dialog on the already-selected asset at a new price. */
export async function openTradeAtPrice(page: Page, price: string) {
  await setLivePrice(page, price)
  await page.locator('.verdict-banner').click()
  await expect(page.locator('.trade-dialog')).toBeVisible()
}

/** Re-price a position that is already selected, without opening the dialog. */
export async function setLivePrice(page: Page, price: string) {
  await page.locator('#current-price').fill(price)
}

export async function buyUnits(page: Page, units: string) {
  await page.locator('#trade-amount').fill(units)
  await page.locator('.trade-btn-buy').click()
  await expect(page.locator('.field-error')).toHaveCount(0)
  await expect(page.locator('.trade-dialog')).toBeHidden()
}

export async function sellUnits(page: Page, units: string) {
  await page.locator('#trade-amount').fill(units)
  await page.locator('.trade-btn-sell').click()
  await expect(page.locator('.field-error')).toHaveCount(0)
  await expect(page.locator('.trade-dialog')).toBeHidden()
}

/** Sell the whole position via the ALL shortcut. */
export async function sellAllUnits(page: Page) {
  await page.locator('.trade-all-btn').click()
  await page.locator('.trade-btn-sell').click()
  await expect(page.locator('.field-error')).toHaveCount(0)
  await expect(page.locator('.trade-dialog')).toBeHidden()
}

/**
 * Sell a dollar amount. Dollar-mode sales route through a confirm step and hand the
 * exact amount entered to the ledger, rather than re-deriving it from a rounded
 * unit count.
 */
export async function sellDollars(page: Page, amount: string) {
  await page.getByRole('radio', { name: /Dollar amount/ }).click()
  await page.locator('#trade-amount').fill(amount)
  await page.locator('.trade-btn-sell').click()
  await expect(page.locator('.trade-sell-confirm')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm SELL' }).click()
  await expect(page.locator('.trade-dialog')).toBeHidden()
}

export function portfolioRow(page: Page, assetName: string): Locator {
  return page.locator('.owned-assets tr', { hasText: assetName })
}

/** Portfolio columns: Asset | Rel. Cost Basis | Total inv. | Net P&L | Realized. */
export async function expectPortfolio(
  row: Locator,
  expected: { relCostBasis?: string; totalInvested?: string; netPnl?: string; realized?: string },
) {
  if (expected.relCostBasis != null) {
    await expect(row.locator('td').nth(1)).toHaveText(expected.relCostBasis)
  }
  if (expected.totalInvested != null) {
    await expect(row.locator('td').nth(2)).toHaveText(expected.totalInvested)
  }
  if (expected.netPnl != null) {
    await expect(row.locator('td').nth(3)).toContainText(expected.netPnl)
  }
  if (expected.realized != null) {
    await expect(row.locator('td').nth(4)).toHaveText(expected.realized)
  }
}
