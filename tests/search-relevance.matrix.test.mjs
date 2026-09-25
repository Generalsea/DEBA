import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { createClient } from '@supabase/supabase-js'

const K = 5
const REPEATS = 3

async function loadLocalEnv() {
  for (const path of ['.env.local', '.env']) {
    try {
      const source = await readFile(new URL('../' + path, import.meta.url), 'utf8')
      for (const rawLine of source.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue

        const equal = line.indexOf('=')
        if (equal <= 0) continue

        const key = line.slice(0, equal).trim()
        let value = line.slice(equal + 1).trim()
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1)
        }

        if (!(key in process.env)) process.env[key] = value
      }
    } catch {
      // Environment variables may already be injected by CI.
    }
  }
}

const matrix = [
  { query: 'iPhone 13', class: 'exact', expected: ['iphone-13-pro-deba-demo'], top1: true },
  { query: 'ايفون 13', class: 'transliteration', expected: ['iphone-13-pro-deba-demo'], top1: true },
  { query: 'آيفون 13', class: 'transliteration', expected: ['iphone-13-pro-deba-demo'], top1: true },
  { query: 'Samsung S23', class: 'exact', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'سامسونج S23', class: 'exact', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'سامسنج S23', class: 'typo', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'جالاكسي S23', class: 'transliteration', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'جالكسي S23', class: 'transliteration', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'Galaxy S23', class: 'transliteration', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'سامسونج هاتف', class: 'brand+category', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'ابل هاتف', class: 'brand+category', expected: ['iphone-13-pro-deba-demo'], top1: true },
  { query: 'سامسونج غسالة', class: 'brand+category', expected: ['samsung-washer-deba-demo'], top1: true },
  { query: 'غسالة سامسونج', class: 'multi-token', expected: ['samsung-washer-deba-demo'], top1: true },
  { query: 'سيارة Hyundai Elantra', class: 'brand+category', expected: ['hyundai-elantra-deba-demo'], top1: true },
  { query: 'Hyundai Elantra', class: 'exact', expected: ['hyundai-elantra-deba-demo'], top1: true },
  { query: 'هيونداي إلنترا', class: 'transliteration', expected: ['hyundai-elantra-deba-demo'], top1: true },
  { query: 'شنيور لاسلكي', class: 'multi-token', expected: ['bosch-drill-deba-demo'], top1: true },
  { query: 'دراجة', class: 'category', expected: ['city-bike-deba-demo'], top1: true },
  { query: 'أريكة مودرن', class: 'multi-token', expected: ['modern-sofa-deba-demo'], top1: true },
  { query: 'مكتب عمل', class: 'multi-token', expected: ['office-desk-deba-demo'], top1: true },
  { query: 'هاتف سامسونج S23 256GB', class: 'brand+category', expected: ['samsung-s23-256-deba-demo'], top1: true },
  { query: 'غسالة EcoBubble Samsung', class: 'multi-token', expected: ['samsung-washer-deba-demo'], top1: true },
  { query: 'شاشة Samsung', class: 'brand+category', expected: ['samsung-s23-256-deba-demo', 'samsung-washer-deba-demo'], top1: true },
  { query: 'DEBA_NO_MATCH_9F7X_20260925', class: 'zero-result', expected: [] },
  { query: 'جهاز_غير_موجود_987654', class: 'zero-result', expected: [] },
  { query: 'ثلاجة_باناسونيك_987654', class: 'zero-result', expected: [] },
  { query: 'سوبر_منتج_99999999', class: 'zero-result', expected: [] },
]

async function getClient() {
  await loadLocalEnv()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function runQuery(supabase, query) {
  const started = performance.now()
  const { data, error } = await supabase.rpc('search_marketplace_products', {
    p_query: query,
    p_limit: K,
    p_offset: 0,
    p_category_slug: null,
    p_min_price: null,
    p_max_price: null,
    p_condition: null,
    p_governorate: null,
    p_city: null,
    p_sort: 'relevance',
  })
  const durationMs = performance.now() - started

  if (error) throw new Error(`RPC failed for "${query}": ${error.message}`)
  return { rows: data ?? [], durationMs }
}

function evaluate(testCase, rows) {
  const slugs = rows.map((row) => row.slug).filter(Boolean)
  const hits = testCase.expected.filter((slug) => slugs.includes(slug))
  const matchAt5 =
    testCase.expected.length === 0 ? rows.length === 0 : hits.length > 0
  const top1Match =
    testCase.expected.length === 0 ? rows.length === 0 : testCase.expected.includes(slugs[0])
  const precisionAt5 =
    testCase.expected.length === 0 ? null : hits.length / K
  const firstRank =
    hits.length === 0 ? null : slugs.findIndex((slug) => testCase.expected.includes(slug)) + 1
  const reciprocalRank = firstRank ? 1 / firstRank : 0

  return {
    matchAt5,
    top1Match,
    precisionAt5,
    reciprocalRank,
    slugs,
  }
}

test('DEBA search relevance matrix: 20+ exact/transliteration/typo/multi-token/zero-result cases', async (t) => {
  assert.ok(matrix.length >= 20, 'matrix must contain at least 20 cases')
  assert.deepEqual(
    [...new Set(matrix.map((item) => item.class))].sort(),
    ['brand+category', 'category', 'exact', 'multi-token', 'transliteration', 'typo', 'zero-result'],
  )

  const supabase = await getClient()
  if (!supabase) {
    t.skip('Supabase env is not available; set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for live relevance testing')
    return
  }

  const evaluations = []
  const durations = []

  for (const testCase of matrix) {
    const samples = []
    let first = null

    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      const result = await runQuery(supabase, testCase.query)
      samples.push(result)
      durations.push(result.durationMs)

      if (!first) first = result
    }

    const evaluation = evaluate(testCase, first.rows)
    evaluations.push({ ...testCase, ...evaluation })

    assert.equal(evaluation.matchAt5, true, `No judged match for "${testCase.query}"`)
    if (testCase.top1) {
      assert.equal(evaluation.top1Match, true, `Expected judged result at rank 1 for "${testCase.query}"`)
    }
    assert.equal(first.rows.length <= K, true)
    assert.ok(
      first.rows.every((row) => Number.isFinite(Number(row.relevance))),
      `Non-finite relevance score for "${testCase.query}"`,
    )
    assert.ok(
      first.rows.length === 0 || first.rows.every((row) => Number(row.total_count) >= first.rows.length),
      `Invalid total_count for "${testCase.query}"`,
    )
  }

  const orderedDurations = [...durations].sort((a, b) => a - b)
  const percentile = (p) => orderedDurations[Math.min(
    orderedDurations.length - 1,
    Math.ceil(orderedDurations.length * p) - 1,
  )]

  const judged = evaluations.filter((item) => item.expected.length > 0)
  const zeroResult = evaluations.filter((item) => item.expected.length === 0)
  const positiveHitsAtK = judged.filter((item) => item.matchAt5).length
  const positiveTop1 = judged.filter((item) => item.top1Match).length
  const positiveOnlyMRR = judged.length
    ? judged.reduce((sum, item) => sum + item.reciprocalRank, 0) / judged.length
    : null
  const zeroResultRate = matrix.length
    ? zeroResult.length / matrix.length
    : null
  const unexpectedPositiveZeroResults = judged.filter((item) => !item.slugs.length).length
  const judgedPrecision = judged.filter((item) => item.precisionAt5 !== null)

  console.log(JSON.stringify({
    coverage: {
      totalCases: matrix.length,
      judgedPositiveCases: judged.length,
      exactOrTransliteratedOrTypo: matrix.filter((item) =>
        ['exact', 'transliteration', 'typo'].includes(item.class),
      ).length,
      multiTokenCases: matrix.filter((item) =>
        ['brand+category', 'multi-token'].includes(item.class),
      ).length,
      zeroResultCases: zeroResult.length,
    },
    quality: {
      hitAtK: judged.length ? positiveHitsAtK / judged.length : null,
      top1MatchAccuracy: judged.length ? positiveTop1 / judged.length : null,
      positiveOnlyMRR,
      zeroResultRate,
      unexpectedPositiveZeroResultRate: judged.length
        ? unexpectedPositiveZeroResults / judged.length
        : null,
      diagnostics: {
        meanPrecisionAt5: judgedPrecision.length
          ? judgedPrecision.reduce((sum, item) => sum + item.precisionAt5, 0) / judgedPrecision.length
          : null,
      },
    },
    latencyMs: {
      samples: durations.length,
      mean: Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(2)),
      p50: Number(percentile(0.50).toFixed(2)),
      p95: Number(percentile(0.95).toFixed(2)),
      max: Number(Math.max(...durations).toFixed(2)),
    },
  }, null, 2))
})
