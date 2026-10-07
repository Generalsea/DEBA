import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { chromium } from '@playwright/test'

const baseURL = process.env.DEBA_E2E_BASE_URL || 'http://127.0.0.1:3000'
const outputPath = process.env.DEBA_E2E_STORAGE_STATE || 'e2e/.auth/state.json'

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext()
const page = await context.newPage()

console.log('DEBA E2E auth bootstrap')
console.log('1) Enter a real Egyptian mobile number.')
console.log('2) Request the WhatsApp OTP.')
console.log('3) Enter the real 6-digit OTP.')
console.log('4) Complete the login flow until the browser leaves /login.')
console.log('The OTP itself is never read, stored, or printed by this script.')

await page.goto(baseURL + '/login', { waitUntil: 'domcontentloaded' })

await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
  timeout: 10 * 60 * 1000,
})

await mkdir(dirname(outputPath), { recursive: true })
await context.storageState({ path: outputPath })

console.log('Saved authenticated Playwright storage state to:', outputPath)
await browser.close()
