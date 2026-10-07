import 'server-only'

export const BROKER_MODEL_ENV = 'DEBA_BROKER_MODEL'
export const BROKER_API_URL_ENV = 'DEBA_BROKER_API_URL'
export const BROKER_API_KEY_ENV = 'DEBA_BROKER_API_KEY'

export type BrokerDecision = {
  action: 'counter_offer' | 'hold' | 'accept' | 'decline'
  amount: number | null
  rationale: string
  confidence: number
}

export async function generateBrokerDecision(input: {
  currentOffer: number
  productPrice: number
  marketMedian: number
  marketConfidence: number
  deterministicProposal: number | null
  round: number
  maxRounds: number
  productSummary: string
}): Promise<BrokerDecision> {
  const url = process.env[BROKER_API_URL_ENV]
  const apiKey = process.env[BROKER_API_KEY_ENV]
  const model = process.env[BROKER_MODEL_ENV]

  if (!url || !apiKey || !model) {
    throw new Error('DEBA broker provider configuration is incomplete.')
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Return JSON only. The database policy is authoritative. Never invent prices or request payment actions.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Suggest a negotiation action using only supplied facts.',
            facts: input,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error('Broker provider request failed with HTTP ' + response.status + '.')
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = payload.choices?.[0]?.message?.content
  if (!raw) throw new Error('Broker provider returned no content.')

  const parsed = JSON.parse(raw) as Record<string, unknown>
  const action = parsed.action
  if (action !== 'counter_offer' && action !== 'hold' && action !== 'accept' && action !== 'decline') {
    throw new Error('Broker provider returned an invalid action.')
  }

  const amount =
    parsed.amount === null || parsed.amount === undefined
      ? null
      : Number(parsed.amount)

  const confidence = Number(parsed.confidence)
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    throw new Error('Broker provider returned an invalid amount.')
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Broker provider returned an invalid confidence.')
  }

  return {
    action,
    amount,
    rationale: String(parsed.rationale ?? '').trim().slice(0, 2000),
    confidence,
  }
}
