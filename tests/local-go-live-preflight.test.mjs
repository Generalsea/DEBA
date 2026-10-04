import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url)
const SCRIPT = new URL('../scripts/local-go-live-preflight.mjs', import.meta.url)
const PACKAGE = new URL('../package.json', import.meta.url)

test('local go-live preflight is wired and passes repository integrity checks', async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE, 'utf8'))
  assert.equal(packageJson.scripts['local:preflight'], 'node scripts/local-go-live-preflight.mjs')

  const run = spawnSync(process.execPath, [SCRIPT.pathname, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env },
  })

  assert.equal(run.status, 0, run.stderr || run.stdout)
  const report = JSON.parse(run.stdout)
  assert.equal(report.summary.fail, 0)
  assert.ok(report.checks.some((check) => check.name === 'Canonical 12-migration release chain' && check.status === 'PASS'))
  assert.ok(report.checks.some((check) => check.name === 'Public-search abuse control' && check.status === 'PASS'))
  assert.ok(report.checks.some((check) => check.name === 'Public secret exposure scan' && check.status === 'PASS'))
})

test('preflight output does not expose secret values', async () => {
  const run = spawnSync(process.execPath, [SCRIPT.pathname, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_SERVICE_ROLE_KEY: 'DEBA_TEST_SERVICE_SECRET_SHOULD_NOT_PRINT',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'DEBA_TEST_PUBLIC_KEY',
    },
  })

  assert.equal(run.status, 0, run.stderr || run.stdout)
  assert.doesNotMatch(run.stdout, /DEBA_TEST_SERVICE_SECRET_SHOULD_NOT_PRINT/)
  assert.doesNotMatch(run.stdout, /DEBA_TEST_PUBLIC_KEY/)
})


test('strict mode accepts inherited baseline environment without requiring optional AI providers', async () => {
  const run = spawnSync(process.execPath, [SCRIPT.pathname, '--json', '--strict'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-secret',
      NEXT_PUBLIC_SITE_URL: 'https://local.example',
    },
  })

  assert.equal(run.status, 0, run.stderr || run.stdout)
  const report = JSON.parse(run.stdout)
  assert.equal(report.summary.fail, 0)
  assert.equal(report.summary.warn, 0)
  assert.ok(report.checks.some((check) => check.name === 'DEBA_EMBEDDING provider configuration' && check.status === 'INFO'))
  assert.ok(report.checks.some((check) => check.name === 'DEBA_BROKER provider configuration' && check.status === 'INFO'))
  assert.ok(report.checks.some((check) => check.name === 'DEBA_VISION provider configuration' && check.status === 'INFO'))
})
