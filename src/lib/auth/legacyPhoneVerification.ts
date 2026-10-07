import 'server-only'

type TwilioVerificationResponse = {
  sid?: string
  service_sid?: string
  account_sid?: string
  to?: string
  channel?: string
  status?: string
  send_code_attempts?: Array<{
    channel?: string
    status?: string
  }>
}

type TwilioVerificationCheckResponse = {
  sid?: string
  service_sid?: string
  account_sid?: string
  to?: string
  channel?: string
  status?: string
  valid?: boolean
}

export class LegacyPhoneVerificationConfigurationError extends Error {}

function getConfig() {
  const accountSid = process.env.DEBA_TWILIO_ACCOUNT_SID?.trim()
  const apiKey = process.env.DEBA_TWILIO_API_KEY?.trim()
  const apiSecret = process.env.DEBA_TWILIO_API_SECRET?.trim()
  const verifyServiceSid = process.env.DEBA_TWILIO_VERIFY_SERVICE_SID?.trim()

  if (!accountSid || !apiKey || !apiSecret || !verifyServiceSid) {
    throw new LegacyPhoneVerificationConfigurationError(
      'Missing DEBA_TWILIO_ACCOUNT_SID, DEBA_TWILIO_API_KEY, DEBA_TWILIO_API_SECRET or DEBA_TWILIO_VERIFY_SERVICE_SID on the server.',
    )
  }

  return { accountSid, apiKey, apiSecret, verifyServiceSid }
}

function authorizationHeader(apiKey: string, apiSecret: string) {
  return 'Basic ' + Buffer.from(apiKey + ':' + apiSecret).toString('base64')
}

async function postForm(path: string, values: Record<string, string>) {
  const { apiKey, apiSecret, verifyServiceSid } = getConfig()

  const response = await fetch(
    'https://verify.twilio.com/v2/Services/' + verifyServiceSid + path,
    {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader(apiKey, apiSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(values).toString(),
      cache: 'no-store',
    },
  )

  const raw = await response.text()
  let payload: unknown = null

  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = raw
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
        ? String((payload as { message?: unknown }).message || 'Twilio Verify request failed.')
        : 'Twilio Verify request failed.'

    throw new Error('Twilio Verify failed: ' + message)
  }

  return payload
}

export async function sendLegacyPhoneWhatsAppVerification(phone: string) {
  const { apiKey, apiSecret, verifyServiceSid } = getConfig()
  if (!verifyServiceSid) {
    throw new LegacyPhoneVerificationConfigurationError('Missing Verify Service.')
  }

  return postForm('/Verifications', {
    To: phone,
    Channel: 'whatsapp',
  }) as Promise<TwilioVerificationResponse>
}

export async function checkLegacyPhoneWhatsAppVerification(
  phone: string,
  code: string,
) {
  return postForm('/VerificationCheck', {
    To: phone,
    Code: code,
  }) as Promise<TwilioVerificationCheckResponse>
}
