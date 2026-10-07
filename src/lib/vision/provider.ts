import 'server-only'

export type VisionInspectionResult = {
  visualScore: number
  structuralScore: number
  cleanlinessScore: number
  descriptionConsistencyScore: number
  conditionGrade: string | null
  confidence: number
  damageFlags: Array<{
    label: string
    severity: 'low' | 'medium' | 'high'
    confidence: number
  }>
  observations: string[]
}

const grades = new Set([
  'new',
  'like_new',
  'excellent',
  'good',
  'fair',
  'poor',
  'for_parts',
])

function score(value: unknown, field: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('Vision provider returned an invalid ' + field + '.')
  }
  return parsed
}

export async function inspectProductImages(input: {
  imageUrls: string[]
  title: string
  description: string
  conditionGrade: string | null
  conditionDetails: string | null
}): Promise<VisionInspectionResult> {
  if (input.imageUrls.length < 1 || input.imageUrls.length > 12) {
    throw new Error('Vision inspection requires 1 to 12 images.')
  }

  if (input.imageUrls.some((url) => !/^https?:\/\//i.test(url))) {
    throw new Error('Vision inspection accepts only HTTP(S) image URLs.')
  }

  const url = process.env.DEBA_VISION_API_URL
  const apiKey = process.env.DEBA_VISION_API_KEY
  const model = process.env.DEBA_VISION_MODEL
  if (!url || !apiKey || !model) {
    throw new Error('DEBA vision provider configuration is incomplete.')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
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
              'Return JSON only. Report visible evidence, uncertainty, damage observations, and consistency with the written listing. Do not infer hidden damage.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  task: 'Grade visible condition and compare it with the written listing condition.',
                  product: {
                    title: input.title,
                    description: input.description,
                    conditionGrade: input.conditionGrade,
                    conditionDetails: input.conditionDetails,
                  },
                }),
              },
              ...input.imageUrls.map((imageUrl) => ({
                type: 'image_url',
                image_url: { url: imageUrl },
              })),
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error('Vision provider request failed with HTTP ' + response.status + '.')
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = payload.choices?.[0]?.message?.content
    if (!raw) throw new Error('Vision provider returned no content.')

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const rawDamage = Array.isArray(parsed.damageFlags) ? parsed.damageFlags : []
    const damageFlags = rawDamage.slice(0, 30).map((value) => {
      const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
      if (row.severity !== 'low' && row.severity !== 'medium' && row.severity !== 'high') {
        throw new Error('Vision provider returned an invalid damage severity.')
      }
      const severity = row.severity as 'low' | 'medium' | 'high'
      return {
        label: String(row.label ?? '').trim().slice(0, 240),
        severity,
        confidence: score(row.confidence, 'damage confidence'),
      }
    })

    const conditionGrade = parsed.conditionGrade == null ? null : String(parsed.conditionGrade)
    if (conditionGrade !== null && !grades.has(conditionGrade)) {
      throw new Error('Vision provider returned an invalid condition grade.')
    }

    const observations = Array.isArray(parsed.observations)
      ? parsed.observations
          .map((value) => String(value).trim().slice(0, 500))
          .filter(Boolean)
          .slice(0, 30)
      : []

    return {
      visualScore: score(parsed.visualScore, 'visualScore'),
      structuralScore: score(parsed.structuralScore, 'structuralScore'),
      cleanlinessScore: score(parsed.cleanlinessScore, 'cleanlinessScore'),
      descriptionConsistencyScore: score(
        parsed.descriptionConsistencyScore,
        'descriptionConsistencyScore',
      ),
      conditionGrade,
      confidence: score(parsed.confidence, 'confidence'),
      damageFlags,
      observations,
    }
  } finally {
    clearTimeout(timeout)
  }
}
