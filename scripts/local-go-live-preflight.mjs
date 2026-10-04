#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const argv = new Set(process.argv.slice(2))
const jsonMode = argv.has('--json')
const strict = argv.has('--strict')

const REQUIRED_FILES = [
  'package.json',
  'package-lock.json',
  'playwright.config.ts',
  'proxy.ts',
  '.env.example',
  'vercel.json',
  'src/utils/publicSearchRateLimit.ts',
]

const REQUIRED_SCRIPTS = [
  'dev',
  'build',
  'typecheck',
  'test',
  'e2e',
  'e2e:list',
  'release:preflight',
  'test:phase4-notifications',
  'test:phase4-2',
  'test:phase4-3',
  'test:phase4-4',
  'test:phase5',
]

const RELEASE_MIGRATIONS = [
  '20260929224200_phase4_realtime_notifications.sql',
  '20260929224300_phase4_2_deal_matching_price_intelligence.sql',
  '20260929230000_phase4_3_future_engine.sql',
  '20260929230100_phase4_3_boost_aware_search.sql',
  '20260929230200_phase4_3_rpc_security_hardening.sql',
  '20260929230300_phase4_3_placement_storage_correction.sql',
  '20260929230400_phase4_3_handshake_cryptographic_hardening.sql',
  '20260929230500_phase4_3_negotiation_constraint_fix.sql',
  '20260929230600_phase4_3_order_reservation_lifecycle_bridge.sql',
  '20260929230700_phase4_3_negotiation_eligibility_hardening.sql',
  '20260930000000_phase4_4_true_vector_search.sql',
  '20260930010000_phase5_ai_broker_vision.sql',
]

const BASE_REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const AI_ENV_GROUPS = [
  ['DEBA_EMBEDDING_API_URL', 'DEBA_EMBEDDING_API_KEY', 'DEBA_EMBEDDING_MODEL'],
  ['DEBA_BROKER_API_URL', 'DEBA_BROKER_API_KEY', 'DEBA_BROKER_MODEL'],
  ['DEBA_VISION_API_URL', 'DEBA_VISION_API_KEY', 'DEBA_VISION_MODEL'],
]

function loadLocalEnv() {
  const values = {}
  for (const relativePath of ['.env.local', '.env']) {
    const fullPath = path.join(ROOT, relativePath)
    if (!existsSync(fullPath)) continue
    const source = readFileSync(fullPath, 'utf8')
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in values)) values[key] = value
    }
  }
  return values
}

async function listSourceFiles(relativePath, output) {
  const fullPath = path.join(ROOT, relativePath)
  if (!existsSync(fullPath)) return
  const stat = statSync(fullPath)
  if (stat.isDirectory()) {
    const entries = await readdir(fullPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
      await listSourceFiles(path.join(relativePath, entry.name), output)
    }
    return
  }
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relativePath)) output.push(relativePath)
}

async function main() {
  const checks = []
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const env = loadLocalEnv()

  const major = Number(process.versions.node.split('.')[0])
  const minor = Number(process.versions.node.split('.')[1])
  checks.push({
    name: 'Node runtime',
    status: major > 22 || (major === 22 && minor >= 14) ? 'PASS' : 'FAIL',
    details: process.versions.node + ' (required >= 22.14.0)',
  })

  checks.push({
    name: 'Required repository files',
    status: REQUIRED_FILES.every((file) => existsSync(path.join(ROOT, file))) ? 'PASS' : 'FAIL',
    details: REQUIRED_FILES.filter((file) => !existsSync(path.join(ROOT, file))).join(', ') || 'All required files exist',
  })

  const missingScripts = REQUIRED_SCRIPTS.filter((name) => typeof packageJson.scripts?.[name] !== 'string')
  checks.push({
    name: 'Required npm scripts',
    status: missingScripts.length ? 'FAIL' : 'PASS',
    details: missingScripts.length ? 'Missing: ' + missingScripts.join(', ') : 'Required scripts present',
  })

  const migrationDir = path.join(ROOT, 'supabase', 'migrations')
  const migrationFiles = existsSync(migrationDir) ? await readdir(migrationDir) : []
  const missingMigrations = RELEASE_MIGRATIONS.filter((file) => !migrationFiles.includes(file))
  const versions = RELEASE_MIGRATIONS.map((file) => Number(file.slice(0, 14)))
  const strictlyIncreasing = versions.every((version, index) => index === 0 || version > versions[index - 1])

  checks.push({
    name: 'Canonical 12-migration release chain',
    status: missingMigrations.length || !strictlyIncreasing ? 'FAIL' : 'PASS',
    details: missingMigrations.length
      ? 'Missing: ' + missingMigrations.join(', ')
      : '12 release files present in strict order',
  })

  const helper = await readFile(path.join(ROOT, 'src/utils/publicSearchRateLimit.ts'), 'utf8')
  const proxy = await readFile(path.join(ROOT, 'proxy.ts'), 'utf8')
  const publicSearchWiring =
    /enforcePublicSearchRateLimit/.test(proxy) &&
    /createHmac\('sha256'/.test(helper) &&
    /SUPABASE_SERVICE_ROLE_KEY/.test(helper) &&
    /PUBLIC_SEARCH_RATE_LIMIT = 60/.test(helper) &&
    /PUBLIC_SEARCH_RATE_WINDOW_SECONDS = 60/.test(helper) &&
    /status: 429/.test(helper) &&
    /status: 503/.test(helper)

  checks.push({
    name: 'Public-search abuse control',
    status: publicSearchWiring ? 'PASS' : 'FAIL',
    details: publicSearchWiring
      ? 'Request-boundary limiter and fail-closed paths detected'
      : 'Limiter wiring is incomplete',
  })

  const sourceFiles = []
  await listSourceFiles('src', sourceFiles)
  await listSourceFiles('proxy.ts', sourceFiles)
  const exposedSecretPatterns = []
  for (const relativePath of sourceFiles) {
    const source = await readFile(path.join(ROOT, relativePath), 'utf8')
    if (/NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)/.test(source)) {
      exposedSecretPatterns.push(relativePath)
    }
  }

  checks.push({
    name: 'Public secret exposure scan',
    status: exposedSecretPatterns.length ? 'FAIL' : 'PASS',
    details: exposedSecretPatterns.length
      ? 'Potential NEXT_PUBLIC secret variable names in: ' + exposedSecretPatterns.join(', ')
      : 'No public key/secret/token variable pattern detected in source',
  })

  const missingBaseEnv = BASE_REQUIRED_ENV.filter((name) => !env[name])
  const siteUrl = env.NEXT_PUBLIC_SITE_URL || ''
  const siteUrlValid = !siteUrl || /^https?:\/\/[^\s/]+(?:\/.*)?$/.test(siteUrl)
  const siteUrlPlaceholder = /your-vercel-domain|your-domain|example\.com/i.test(siteUrl)

  checks.push({
    name: 'Local baseline environment',
    status:
      missingBaseEnv.length || (strict && (!siteUrl || !siteUrlValid || siteUrlPlaceholder))
        ? 'FAIL'
        : missingBaseEnv.length
          ? 'INFO'
          : 'PASS',
    details: missingBaseEnv.length
      ? 'Missing: ' + missingBaseEnv.join(', ')
      : 'Baseline values detected; secret values are never printed',
  })

  for (const group of AI_ENV_GROUPS) {
    const count = group.filter((name) => Boolean(env[name])).length
    const prefix = group[0].replace(/_API_URL$/, '')
    checks.push({
      name: prefix + ' provider configuration',
      status: count === 0 ? 'INFO' : count === group.length ? 'PASS' : 'WARN',
      details: count === 0 ? 'Not configured locally' : count + '/' + group.length + ' variables present',
    })
  }

  const playwright = await readFile(path.join(ROOT, 'playwright.config.ts'), 'utf8')
  const playwrightOk =
    /DEBA_E2E_BASE_URL/.test(playwright) &&
    /127\.0\.0\.1|localhost/.test(playwright) &&
    /webServer/.test(playwright)
  checks.push({
    name: 'Playwright local-first configuration',
    status: playwrightOk ? 'PASS' : 'FAIL',
    details: playwrightOk ? 'Local default and web-server bootstrap are configured' : 'Local Playwright bootstrap is incomplete',
  })

  checks.push({
    name: 'E2E suite directory',
    status: existsSync(path.join(ROOT, 'e2e')) ? 'PASS' : 'FAIL',
    details: existsSync(path.join(ROOT, 'e2e')) ? 'e2e directory exists' : 'e2e directory missing',
  })

  const failures = checks.filter((check) => check.status === 'FAIL')
  const strictNonPass = strict ? checks.filter((check) => check.status === 'WARN') : []
  const summary = {
    pass: checks.filter((check) => check.status === 'PASS').length,
    info: checks.filter((check) => check.status === 'INFO').length,
    warn: checks.filter((check) => check.status === 'WARN').length,
    fail: failures.length,
    strict,
  }

  const report = { summary, checks }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log('DEBA — LOCAL GO-LIVE PREFLIGHT')
    console.log('================================')
    for (const check of checks) {
      console.log('[' + check.status + '] ' + check.name + ' — ' + check.details)
    }
    console.log('')
    console.log('SUMMARY: PASS=' + summary.pass + ' INFO=' + summary.info + ' WARN=' + summary.warn + ' FAIL=' + summary.fail)
  }

  if (failures.length || strictNonPass.length) process.exitCode = 1
}

await main()
