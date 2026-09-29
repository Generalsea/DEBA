import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const ROOT = new URL('..', import.meta.url)
const MIGRATION = new URL(
  '../supabase/migrations/20260930000000_phase4_4_true_vector_search.sql',
  import.meta.url,
)
const PROVIDER = new URL('../src/lib/embeddings/provider.ts', import.meta.url)
const SEARCH_ROUTE = new URL(
  '../src/app/api/search/hybrid/route.ts',
  import.meta.url,
)
const INDEX_ROUTE = new URL(
  '../src/app/api/embeddings/products/[id]/route.ts',
  import.meta.url,
)
const ENV = new URL('../.env.example', import.meta.url)

test('Phase 4.4 migration establishes a real pgvector/HNSW/RRF contract', async () => {
  const sql = await readFile(MIGRATION, 'utf8')

  assert.match(sql, /create extension if not exists vector with schema extensions/i)
  assert.doesNotMatch(sql, /create extension if not exists vector.*version/i)
  assert.match(sql, /extensions\.vector\(1536\)/i)
  assert.match(sql, /using hnsw/i)
  assert.match(sql, /extensions\.vector_cosine_ops/i)
  assert.match(sql, /where searchable_active = true and embedding is not null/i)
  assert.match(sql, /private\.product_embeddings/i)
  assert.match(sql, /source_hash text not null/i)
  assert.match(sql, /semantic_search_product_ids/i)
  assert.match(sql, /search_marketplace_hybrid/i)
  assert.match(sql, /1\.0 \/ \(params\.safe_rrf_k \+ lexical\.rank_ix\)/i)
  assert.match(sql, /1\.0 \/ \(params\.safe_rrf_k \+ trigram\.rank_ix\)/i)
  assert.match(sql, /1\.0 \/ \(params\.safe_rrf_k \+ semantic\.semantic_rank\)/i)
  assert.match(sql, /set hnsw\.iterative_scan = strict_order/i)
  assert.match(sql, /update private\.product_embeddings/i)
  assert.match(sql, /title.*description.*condition_details.*city.*governorate.*district.*category_id.*metadata/s)
  assert.match(sql, /searchable_active = \(/i)
  assert.match(sql, /grant execute on function public\.upsert_product_embedding/i)
  assert.match(sql, /to service_role/i)
  assert.match(sql, /to authenticated/i)
})

test('embedding provider is real and provider-agnostic; it never fabricates vectors', async () => {
  const source = await readFile(PROVIDER, 'utf8')

  assert.match(source, /DEBA_EMBEDDING_API_URL/)
  assert.match(source, /DEBA_EMBEDDING_API_KEY/)
  assert.match(source, /DEBA_EMBEDDING_MODEL/)
  assert.match(source, /fetch\(endpoint/)
  assert.match(source, /embeddingDimensions|DEBA_EMBEDDING_DIMENSIONS/)
  assert.match(source, /embedding\.length !== DEBA_EMBEDDING_DIMENSIONS/)
  assert.match(source, /Number\(component\)/)
  assert.doesNotMatch(source, /Math\.random/)
  assert.doesNotMatch(source, /Array\.from\(\{ length/)
})

test('server routes keep embedding API credentials server-side', async () => {
  const [searchRoute, indexRoute, env] = await Promise.all([
    readFile(SEARCH_ROUTE, 'utf8'),
    readFile(INDEX_ROUTE, 'utf8'),
    readFile(ENV, 'utf8'),
  ])

  assert.match(searchRoute, /await createClient\(\)/)
  assert.match(searchRoute, /await supabase\.auth\.getUser\(\)/)
  assert.match(searchRoute, /generateEmbedding/)
  assert.match(searchRoute, /search_marketplace_hybrid/)
  assert.match(indexRoute, /await supabase\.auth\.getUser\(\)/)
  assert.match(indexRoute, /product\.owner_id !== user\.id/)
  assert.match(indexRoute, /createAdminClient/)
  assert.match(indexRoute, /upsert_product_embedding/)
  assert.match(env, /^DEBA_EMBEDDING_API_URL=/m)
  assert.match(env, /^DEBA_EMBEDDING_API_KEY=/m)
  assert.match(env, /^DEBA_EMBEDDING_MODEL=/m)
  assert.doesNotMatch(searchRoute, /NEXT_PUBLIC_DEBA_EMBEDDING/)
  assert.doesNotMatch(indexRoute, /NEXT_PUBLIC_DEBA_EMBEDDING/)
})

test('Phase 4.4 integration smoke is opt-in and never fabricates production embeddings', async (t) => {
  const envPath = ROOT
  let env = ''
  try {
    env = await readFile(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    env = ''
  }

  const migrationApplied =
    env.includes('DEBA_PHASE44_INTEGRATION=1') ||
    process.env.DEBA_PHASE44_INTEGRATION === '1'

  if (!migrationApplied) {
    t.skip('Set DEBA_PHASE44_INTEGRATION=1 only in an environment where the migration has been intentionally applied.')
    return
  }

  assert.ok(
    process.env.DEBA_EMBEDDING_API_URL,
    'DEBA_EMBEDDING_API_URL must be configured for a true semantic integration test.',
  )
  assert.ok(
    process.env.DEBA_EMBEDDING_MODEL,
    'DEBA_EMBEDDING_MODEL must be configured for a true semantic integration test.',
  )
})
