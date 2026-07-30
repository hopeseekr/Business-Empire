import { test, expect } from '@playwright/test'
import { buyUnits, gotoCleanInvestments, openTradeDialog, portfolioRow } from './investments-helpers'

/**
 * Both bugs here were silent/misleading rather than crashes: a first-ever buy on a
 * fresh position did nothing (no error, no shares recorded), and a price/quantity
 * typed with more than 8 decimal digits was rejected outright with "Enter a valid
 * last price greater than 0." even though it's clearly a valid positive number.
 * See src/data/fixedPoint.ts (parseFixed8, addFixed8, weightedAverageCost).
 */

test.describe('Investments trade dialog — buy', () => {
  test('records a first-ever buy when nothing is invested yet', async ({ page }) => {
    await gotoCleanInvestments(page)

    // AD&D's average is $25.22 — $15 is below average, so the verdict is BUY.
    await openTradeDialog(page, 'AD&D', '15')
    await buyUnits(page, '10')

    const ownedRow = portfolioRow(page, 'AD&D')
    await expect(ownedRow).toBeVisible()
    await expect(ownedRow).toContainText('$150.00')
  })

  test('accepts a price/quantity with more than 8 decimal digits', async ({ page }) => {
    await gotoCleanInvestments(page)

    await page.getByRole('tab', { name: /crypto/i }).click()
    await openTradeDialog(page, 'Cosmos', '9.933540538')
    await buyUnits(page, '33769735')

    const ownedRow = portfolioRow(page, 'Cosmos')
    await expect(ownedRow).toBeVisible()
    await expect(ownedRow).toContainText('$335,453,031.58')
  })
})
