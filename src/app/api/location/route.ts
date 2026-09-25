import { NextResponse } from 'next/server'

type ResolvedLocation = {
  city: string | null
  district: string | null
  governorate: string | null
  country: string | null
}

function clampCoordinate(value: unknown, min: number, max: number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max ? numberValue : null
}

function headerLocation(request: Request): ResolvedLocation {
  const city = request.headers.get('x-vercel-ip-city')?.trim() || null
  const region = request.headers.get('x-vercel-ip-country-region')?.trim() || null
  const country = request.headers.get('x-vercel-ip-country')?.trim() || null

  return {
    city,
    district: null,
    governorate: region,
    country,
  }
}

export async function GET(request: Request) {
  const location = headerLocation(request)

  return NextResponse.json({
    location: location.city || location.governorate || location.country ? {
      ...location,
      source: 'network',
    } : null,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { latitude?: unknown; longitude?: unknown }
    const latitude = clampCoordinate(body.latitude, -90, 90)
    const longitude = clampCoordinate(body.longitude, -180, 180)

    if (latitude === null || longitude === null) {
      return NextResponse.json({ error: 'إحداثيات الموقع غير صالحة.' }, { status: 400 })
    }

    const query = new URLSearchParams({
      format: 'jsonv2',
      lat: latitude.toString(),
      lon: longitude.toString(),
      zoom: '18',
      addressdetails: '1',
      'accept-language': 'ar',
    })

    const response = await fetch('https://nominatim.openstreetmap.org/reverse?' + query.toString(), {
      headers: {
        'User-Agent': 'DEBA-Marketplace/1.0 location-resolution',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ location: null }, { status: 200 })
    }

    const data = (await response.json()) as {
      address?: {
        city?: string
        town?: string
        village?: string
        suburb?: string
        neighbourhood?: string
        district?: string
        state?: string
        state_district?: string
        country?: string
      }
    }

    const address = data.address || {}
    const city = address.city || address.town || address.village || null
    const district = address.neighbourhood || address.suburb || address.district || null
    const governorate = address.state || address.state_district || null

    return NextResponse.json({
      location: {
        city,
        district,
        governorate,
        country: address.country || null,
        source: 'browser',
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('DEBA location resolution failed', error)
    return NextResponse.json({ location: null }, { status: 200 })
  }
}