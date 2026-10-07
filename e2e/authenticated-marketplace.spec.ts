import { test, expect } from '@playwright/test'

const storageState = process.env.DEBA_E2E_STORAGE_STATE
const searchQuery = process.env.DEBA_E2E_SEARCH_QUERY
const productSlug = process.env.DEBA_E2E_PRODUCT_SLUG
const allowMutations = process.env.DEBA_E2E_ALLOW_MUTATIONS === 'true'
const reportDescription = 'DEBA authenticated E2E report ' + Date.now()

function requireE2EConfig() {
  const missing = [
    !storageState && 'DEBA_E2E_STORAGE_STATE',
    !searchQuery && 'DEBA_E2E_SEARCH_QUERY',
    !productSlug && 'DEBA_E2E_PRODUCT_SLUG',
    !allowMutations && 'DEBA_E2E_ALLOW_MUTATIONS=true',
  ].filter(Boolean)

  if (missing.length) {
    throw new Error(
      'Authenticated E2E requires a real phone-verified Playwright storage state and mutation consent. Missing: ' +
        missing.join(', '),
    )
  }
}

test.use({ storageState })

test('authenticated marketplace critical path: verified session -> search -> product -> chat offer -> report', async ({
  page,
}) => {
  requireE2EConfig()

  await test.step('reuse a real phone-verified session', async () => {
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 })
  })

  let productUrl = '/products/' + encodeURIComponent(productSlug!)

  await test.step('search marketplace and resolve the designated product', async () => {
    await page.goto('/')
    const search = page.getByTestId('marketplace-search').first()
    await search.fill(searchQuery!)
    await search.press('Enter')

    await expect(page).toHaveURL(new RegExp('[?&]q='), { timeout: 10_000 })

    const productLink = page.locator(
      'a[href="/products/' + encodeURIComponent(productSlug!) + '"]',
    ).first()

    await expect(productLink).toBeVisible({ timeout: 15_000 })
    productUrl = await productLink.getAttribute('href') || productUrl
    expect(productUrl).toContain('/products/')
    await productLink.click()
  })

  await test.step('view product and enter real seller chat', async () => {
    await expect(page.locator('main h1').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('a[href*="/chat?product="]').first()).toBeVisible({
      timeout: 15_000,
    })
    await page.locator('a[href*="/chat?product="]').first().click()
    await expect(page).toHaveURL(/\/chat(?:\?|$)/)
  })

  await test.step('create an offer in the exact DEBA Comms surface', async () => {
    let dialogCount = 0
    page.on('dialog', async (dialog) => {
      dialogCount += 1
      await dialog.accept(dialogCount === 1 ? '160' : 'Authenticated E2E offer')
    })

    const comms = page.frameLocator('iframe').first()
    await expect(comms.locator('[data-testid="chat-create-offer"]')).toBeVisible({
      timeout: 15_000,
    })
    await comms.locator('[data-testid="chat-create-offer"]').click()
    await expect(comms.locator('.offer-card').last()).toContainText('160', {
      timeout: 20_000,
    })
    expect(dialogCount).toBe(2)
  })

  await test.step('submit a real report for the designated listing', async () => {
    await page.goto(productUrl)
    await expect(page.getByTestId('report-open')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('report-open').click()
    await page.getByTestId('report-reason').selectOption('other')
    await page.getByTestId('report-description').fill(reportDescription)
    await page.getByTestId('report-submit').click()
    await expect(page.getByText('تم إرسال البلاغ إلى فريق المراجعة.')).toBeVisible({
      timeout: 15_000,
    })
  })
})
