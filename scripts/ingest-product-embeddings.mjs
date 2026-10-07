import { createHash } from 'node:crypto'
import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'

try {
  loadEnvFile('.env.local')
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
const embeddingUrl = process.env.DEBA_EMBEDDING_API_URL?.trim()
const embeddingKey = process.env.DEBA_EMBEDDING_API_KEY?.trim() || ''
const embeddingModel = process.env.DEBA_EMBEDDING_MODEL?.trim()
const dimensions = 1536

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')
const BATCH_SIZE = parsePositiveInt(process.env.DEBA_EMBEDDING_BATCH_SIZE, 10)
const MAX_PRODUCTS = parsePositiveInt(process.env.DEBA_EMBEDDING_MAX_PRODUCTS, 0)

function parsePositiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

if (!url || !serviceKey) {
  throw new Error(
    'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.',
  )
}

if (!embeddingUrl || !embeddingModel) {
  throw new Error(
    'Missing semantic provider configuration. Set DEBA_EMBEDDING_API_URL and DEBA_EMBEDDING_MODEL.',
  )
}

if (APPLY && process.env.DEBA_PHASE44_PRODUCTION !== '1') {
  throw new Error(
    'Production ingestion is locked. Set DEBA_PHASE44_PRODUCTION=1 explicitly before using --apply.',
  )
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function assertEmbedding(value) {
  if (!Array.isArray(value) || value.length !== dimensions) {
    throw new Error(
      'Embedding dimension mismatch: expected ' +
        dimensions +
        ', received ' +
        (Array.isArray(value) ? value.length : 'invalid'),
    )
  }

  const embedding = value.map(Number)
  if (!embedding.every(Number.isFinite)) {
    throw new Error('Embedding provider returned a non-finite value.')
  }

  return embedding
}

async function generateEmbedding(input) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (embeddingKey) headers.Authorization = 'Bearer ' + embeddingKey

    const response = await fetch(embeddingUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: embeddingModel,
        input,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        'Embedding provider returned HTTP ' +
          response.status +
          ': ' +
          JSON.stringify(payload),
      )
    }

    const raw = payload?.data?.[0]?.embedding ?? payload?.embedding
    return assertEmbedding(raw)
  } finally {
    clearTimeout(timeout)
  }
}

function toPgVector(embedding) {
  return '[' + embedding.join(',') + ']'
}

async function loadProducts() {
  const products = []
  let from = 0

  while (true) {
    const to = from + 99
    let query = supabase
      .from('products')
      .select('id,title,status,moderation_status,listing_type,owner_id,quantity,price')
      .eq('status', 'published')
      .eq('moderation_status', 'approved')
      .eq('listing_type', 'sale')
      .not('owner_id', 'is', null)
      .gt('quantity', 0)
      .gt('price', 0)
      .order('id', { ascending: true })
      .range(from, to)

    const { data, error } = await query
    if (error) throw error

    const rows = data || []
    products.push(...rows)

    if (rows.length < 100 || (MAX_PRODUCTS > 0 && products.length >= MAX_PRODUCTS)) break
    from += 100
  }

  return MAX_PRODUCTS > 0 ? products.slice(0, MAX_PRODUCTS) : products
}

async function getSource(productId) {
  const { data, error } = await supabase.rpc('get_product_embedding_source', {
    p_product_id: productId,
  })

  if (error) throw new Error('Source lookup failed for ' + productId + ': ' + error.message)
  if (typeof data !== 'string' || !data.trim()) {
    throw new Error('Empty embedding source for ' + productId)
  }

  return data
}

async function getStatus(productId) {
  const { data, error } = await supabase.rpc('get_product_embedding_status', {
    p_product_id: productId,
  })

  if (error) throw new Error('Embedding status lookup failed: ' + error.message)
  return data || {}
}

async function ingestProduct(product) {
  const source = await getSource(product.id)
  const sourceHash = sha256(source)
  const status = await getStatus(product.id)

  const unchanged =
    !FORCE &&
    status.exists === true &&
    status.sourceHash === sourceHash &&
    status.embeddingModel === embeddingModel &&
    status.searchableActive === true

  if (unchanged) {
    return { state: 'skipped', id: product.id, reason: 'unchanged' }
  }

  if (!APPLY) {
    return { state: 'planned', id: product.id, sourceHash }
  }

  const embedding = await generateEmbedding(source)

  const { data, error } = await supabase.rpc('upsert_product_embedding', {
    p_product_id: product.id,
    p_embedding: toPgVector(embedding),
    p_model: embeddingModel,
  })

  if (error) throw new Error('Embedding upsert failed for ' + product.id + ': ' + error.message)

  return { state: 'ingested', id: product.id, result: data }
}

const products = await loadProducts()
console.log(
  JSON.stringify(
    {
      mode: APPLY ? 'APPLY' : 'DRY_RUN',
      force: FORCE,
      batchSize: BATCH_SIZE,
      targetCount: products.length,
      providerModel: embeddingModel,
      dimensions,
      productionGuard: process.env.DEBA_PHASE44_PRODUCTION === '1',
    },
    null,
    2,
  ),
)

let counters = { planned: 0, skipped: 0, ingested: 0, failed: 0 }

for (let index = 0; index < products.length; index += BATCH_SIZE) {
  const batch = products.slice(index, index + BATCH_SIZE)

  for (const product of batch) {
    try {
      const result = await ingestProduct(product)
      counters[result.state] = (counters[result.state] || 0) + 1
      console.log(
        '[' +
          (index + counters.ingested + counters.skipped + counters.planned) +
          '/' +
          products.length +
          '] ' +
          result.state +
          ' ' +
          product.id +
          ' ' +
          product.title,
      )
    } catch (error) {
      counters.failed += 1
      console.error(
        'FAILED ' +
          product.id +
          ': ' +
          (error instanceof Error ? error.message : String(error)),
      )
      if (APPLY) throw error
    }
  }

  if (index + BATCH_SIZE < products.length) {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

console.log(JSON.stringify({ done: true, counters }, null, 2))
if (counters.failed > 0) process.exitCode = 1
