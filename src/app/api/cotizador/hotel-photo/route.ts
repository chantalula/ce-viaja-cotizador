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
    const photos = data.photos ?? []
    if (photos.length === 0) return null
    return photos[0].src.large2x
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ urls: [null, null, null] })

    const city = (location || '').split(',')[0].trim()

    // 3 independent Pexels searches — each tries specific first, generic as fallback
    const [room, exterior, destination] = await Promise.all([
      pexels(`${name} hotel room`).then(u => u ?? pexels('luxury hotel room suite')),
      pexels(`${name} ${city} hotel exterior`).then(u => u ?? pexels(`${city} luxury resort hotel`)),
      pexels(`${city} travel`).then(u => u ?? pexels('tropical beach vacation resort')),
    ])

    return NextResponse.json({ urls: [room, exterior, destination] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ urls: [null, null, null], error: msg }, { status: 500 })
  }
}
