import 'server-only'

export const DEBA_EMBEDDING_DIMENSIONS = 1536

type EmbeddingResponse = {
  data?: Array<{ embedding?: unknown }>
  embedding?: unknown
}

function getEmbeddingConfig() {
  const endpoint = process.env.DEBA_EMBEDDING_API_URL?.trim()
  const apiKey = process.env.DEBA_EMBEDDING_API_KEY?.trim() || ''
  const model = process.env.DEBA_EMBEDDING_MODEL?.trim()

  if (!endpoint || !model) {
    throw new Error(
      'Semantic search embedding provider is not configured. Set DEBA_EMBEDDING_API_URL and DEBA_EMBEDDING_MODEL.',
    )
  }

  return { endpoint, apiKey, model }
}

function assertEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error('Embedding provider returned an invalid vector.')
  }

  if (value.length !== DEBA_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${DEBA_EMBEDDING_DIMENSIONS}, received ${value.length}.`,
    )
  }

  const embedding = value.map((component) => Number(component))
  if (!embedding.every(Number.isFinite)) {
    throw new Error('Embedding provider returned a non-finite vector component.')
  }

  return embedding
}

export async function generateEmbedding(input: string) {
  const text = input.trim()
  if (!text) throw new Error('Embedding input cannot be empty.')
  if (text.length > 30000) {
    throw new Error('Embedding input exceeds the DEBA semantic-search source limit.')
  }

  const { endpoint, apiKey, model } = getEmbeddingConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers.Authorization = 'Bearer ' + apiKey
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        input: text,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = (await response.json().catch(() => null)) as EmbeddingResponse | null

    if (!response.ok) {
      const providerMessage =
        payload && typeof (payload as Record<string, unknown>).error === 'object'
          ? JSON.stringify((payload as Record<string, unknown>).error)
          : 'unknown provider error'
      throw new Error(
        `Embedding provider request failed with ${response.status}: ${providerMessage}`,
      )
    }

    const rawEmbedding =
      payload?.data?.[0]?.embedding ??
      payload?.embedding

    return {
      model,
      embedding: assertEmbedding(rawEmbedding),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function embeddingToPgVector(embedding: number[]) {
  if (embedding.length !== DEBA_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Cannot serialize an embedding with dimension ${embedding.length}; expected ${DEBA_EMBEDDING_DIMENSIONS}.`,
    )
  }

  return '[' + embedding.map((value) => String(value)).join(',') + ']'
}
