import { test, expect, type Page } from '@playwright/test'

/**
 * Both bugs here were silent/misleading rather than crashes: a first-ever buy on a
 * fresh position did nothing (no error, no shares recorded), and a price/quantity
 * typed with more than 8 decimal digits was rejected outright with "Enter a valid
 * last price greater than 0." even though it's clearly a valid positive number.
 * See src/data/fixedPoint.ts (parseFixed8, addFixed8, weightedAverageCost).
 */

async function gotoCleanInvestments(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/#/investments')
}

async function openTradeDialog(page: Page, assetName: string, price: string) {
  await page.getByText(assetName, { exact: true }).click()
  await page.locator('#current-price').fill(price)
  await page.locator('.verdict-banner').click()
  await expect(page.locator('.trade-dialog')).toBeVisible()
}

test.describe('Investments trade dialog — buy', () => {
  test('records a first-ever buy when nothing is invested yet', async ({ page }) => {
    await gotoCleanInvestments(page)

    // AD&D's average is $25.22 — $15 is below average, so the verdict is BUY.
    await openTradeDialog(page, 'AD&D', '15')

    await page.locator('#trade-amount').fill('10')
    await page.locator('.trade-btn-buy').click()

    await expect(page.locator('.field-error')).toHaveCount(0)
    await expect(page.locator('.trade-dialog')).toBeHidden()

    const ownedRow = page.locator('.owned-assets tr', { hasText: 'AD&D' })
    await expect(ownedRow).toBeVisible()
    await expect(ownedRow).toContainText('$150.00')
  })

  test('accepts a price/quantity with more than 8 decimal digits', async ({ page }) => {
    await gotoCleanInvestments(page)

    await page.getByRole('tab', { name: /crypto/i }).click()
    await openTradeDialog(page, 'Cosmos', '9.933540538')

    await page.locator('#trade-amount').fill('33769735')
    await page.locator('.trade-btn-buy').click()

    await expect(page.locator('.field-error')).toHaveCount(0)
    await expect(page.locator('.trade-dialog')).toBeHidden()

    const ownedRow = page.locator('.owned-assets tr', { hasText: 'Cosmos' })
    await expect(ownedRow).toBeVisible()
    await expect(ownedRow).toContainText('$335,453,031.58')
  })
})
