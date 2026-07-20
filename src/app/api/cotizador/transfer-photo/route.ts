import { NextRequest, NextResponse } from 'next/server'

async function pexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return null
    const data = await res.json() as { photos?: { src: { large2x: string } }[] }
    return data.photos?.[0]?.src?.large2x ?? null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const { vehicle } = await request.json() as { vehicle: string }
    const v = (vehicle || '').toLowerCase().trim()
    if (!v) return NextResponse.json({ url: null })

    // Map common Spanish vehicle names to better Pexels search terms
    let query = v
    if (v.includes('van') || v.includes('minivan') || v.includes('sprinter')) {
      query = 'private transfer van minivan vehicle'
    } else if (v.includes('bus') || v.includes('autobus') || v.includes('minibus') || v.includes('coach')) {
      query = 'private charter bus coach vehicle'
    } else if (v.includes('suv') || v.includes('4x4')) {
      query = 'luxury SUV transfer vehicle'
    } else if (v.includes('sedan') || v.includes('sedán') || v.includes('ejecutiv')) {
      query = 'executive sedan car transfer'
    } else if (v.includes('limousine') || v.includes('limusina') || v.includes('limo')) {
      query = 'limousine luxury car transfer'
    } else if (v.includes('pickup') || v.includes('camioneta')) {
      query = 'pickup truck passenger transfer'
    } else {
      query = `${v} transfer vehicle`
    }

    const url =
      await pexels(query)
      ?? await pexels(`${v} passenger vehicle`)
      ?? await pexels('private transfer vehicle car')

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
