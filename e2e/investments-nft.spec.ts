import { test, expect, type Page } from '@playwright/test'

/**
 * NFT buy spends liquid coins; sell returns them. Prices are static in-game
 * (e.g. neo = 1 ETH). See buyNft / sellNft in Investments.tsx.
 */

async function gotoCleanInvestments(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/#/investments')
}

async function openCryptoTrade(page: Page, assetName: string, price: string) {
  await page.getByRole('tab', { name: /crypto/i }).click()
  await page.getByText(assetName, { exact: true }).click()
  await page.locator('#current-price').fill(price)
  await page.locator('.verdict-banner').click()
  await expect(page.locator('.trade-dialog')).toBeVisible()
}

test.describe('NFT buy/sell adjusts liquid coin balance', () => {
  test('buying an NFT subtracts its fixed ETH price from holdings', async ({ page }) => {
    await gotoCleanInvestments(page)
    await openCryptoTrade(page, 'ETH', '2000')

    // Buy 100 ETH at $2000.
    await page.locator('#trade-amount').fill('100')
    await page.locator('.trade-btn-buy').click()
    await expect(page.locator('.trade-dialog')).toBeHidden()

    const ethRow = page.locator('.owned-assets tr', { hasText: 'ETH' })
    await expect(ethRow).toBeVisible()
    // Mark-to-market: 100 × $2000 = $200,000
    await expect(ethRow).toContainText('$200,000.00')

    // Expand NFTs and open trade dialog.
    await ethRow.getByRole('button', { name: /\+ NFTs/i }).click()
    await page.getByRole('button', { name: /Trade ETH NFT/i }).click()
    await expect(page.getByRole('dialog', { name: /Trade NFT/i })).toBeVisible()

    // Buy "neo" for 1 ETH (exact name — many NFTs contain "neo").
    await page.locator('.nft-option').filter({ has: page.locator('strong', { hasText: /^neo$/ }) }).click()
    await page.getByRole('button', { name: /BUY 1 NFT/i }).click()
    await expect(page.getByRole('dialog', { name: /Trade NFT/i })).toBeHidden()

    // Liquid ETH is now 99 → $198,000 mark-to-market.
    await expect(ethRow).toContainText('$198,000.00')
    await expect(page.locator('.nft-register')).toContainText('neo')
    await expect(page.locator('.nft-register')).toContainText('99 liquid ETH')
  })

  test('selling an NFT adds its fixed ETH price back to holdings', async ({ page }) => {
    await gotoCleanInvestments(page)
    await openCryptoTrade(page, 'ETH', '2000')

    await page.locator('#trade-amount').fill('50')
    await page.locator('.trade-btn-buy').click()
    await expect(page.locator('.trade-dialog')).toBeHidden()

    const ethRow = page.locator('.owned-assets tr', { hasText: 'ETH' })
    await ethRow.getByRole('button', { name: /\+ NFTs/i }).click()
    await page.getByRole('button', { name: /Trade ETH NFT/i }).click()

    // Buy nikeeeneo (15 ETH).
    await page.locator('.nft-option', { hasText: 'nikeeeneo' }).click()
    await page.getByRole('button', { name: /BUY 1 NFT/i }).click()
    await expect(page.getByRole('dialog', { name: /Trade NFT/i })).toBeHidden()

    // 50 − 15 = 35 ETH → $70,000
    await expect(ethRow).toContainText('$70,000.00')

    // Sell from the register list.
    await page.locator('.nft-group li', { hasText: 'nikeeeneo' }).getByRole('button', { name: /Sell/i }).click()

    // Back to 50 ETH → $100,000
    await expect(ethRow).toContainText('$100,000.00')
    await expect(page.locator('.nft-register')).toContainText('none owned')
  })

  test('cannot buy an NFT that costs more than liquid ETH', async ({ page }) => {
    await gotoCleanInvestments(page)
    await openCryptoTrade(page, 'ETH', '2000')

    // Only 10 ETH — not enough for demonneo (666).
    await page.locator('#trade-amount').fill('10')
    await page.locator('.trade-btn-buy').click()
    await expect(page.locator('.trade-dialog')).toBeHidden()

    const ethRow = page.locator('.owned-assets tr', { hasText: 'ETH' })
    await ethRow.getByRole('button', { name: /\+ NFTs/i }).click()
    await page.getByRole('button', { name: /Trade ETH NFT/i }).click()

    await page.locator('.nft-option', { hasText: 'demonneo' }).click()
    const buyBtn = page.getByRole('button', { name: /BUY 1 NFT/i })
    await expect(buyBtn).toBeDisabled()
    await expect(page.getByRole('dialog')).toContainText(/Need 666 ETH/i)
  })
})
