const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}

const EGYPT_MOBILE_PREFIXES = new Set(['010', '011', '012', '015'])

function toAsciiDigits(value: string) {
  return Array.from(value, (char) => ARABIC_DIGITS[char] ?? char).join('')
}

export function normalizeEgyptianPhone(input: string) {
  const value = toAsciiDigits(input).replace(/[\s().-]/g, '')

  if (/^0020\d+$/.test(value)) {
    return '+' + value.slice(2)
  }

  if (/^20\d+$/.test(value)) {
    return '+' + value
  }

  if (/^01\d{9}$/.test(value)) {
    return '+20' + value.slice(1)
  }

  return null
}

export function isValidEgyptianPhone(input: string) {
  const e164 = normalizeEgyptianPhone(input)
  if (!e164 || !/^\+20(?:10|11|12|15)\d{8}$/.test(e164)) {
    return false
  }

  const local = '0' + e164.slice(3)
  return EGYPT_MOBILE_PREFIXES.has(local.slice(0, 3)) && local.length === 11
}

export function assertEgyptianPhone(input: string) {
  const phone = normalizeEgyptianPhone(input)

  if (!phone || !isValidEgyptianPhone(phone)) {
    throw new Error('INVALID_EGYPTIAN_PHONE')
  }

  return phone
}

export function maskEgyptianPhone(e164: string) {
  if (!isValidEgyptianPhone(e164)) return 'رقم هاتف'
  return e164.slice(0, 5) + '••••••' + e164.slice(-2)
}
