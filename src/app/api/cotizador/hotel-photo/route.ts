import { NextRequest, NextResponse } from 'next/server'

async function pexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return null
    const data = await res.json() as { photos?: { src: { large2x: string } }[] }
    return data.photos?.[0]?.src?.large2x ?? null
  } catch { return null }
}

async function wikimedia(query: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=5&format=json`,
      { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
    )
    if (!searchRes.ok) return null
    const data = await searchRes.json()
    const files: { title: string }[] = data.query?.search || []
    for (const file of files) {
      const imgRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(file.title)}&prop=imageinfo&iiprop=url&iiurlwidth=1600&format=json`,
        { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
      )
      if (!imgRes.ok) continue
      const imgData = await imgRes.json()
      const pages = imgData.query?.pages
      if (!pages) continue
      const page = Object.values(pages)[0] as { imageinfo?: { thumburl?: string; url: string }[] }
      const url = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url
      if (url) return url
    }
    return null
  } catch { return null }
}

async function best(queries: string[]): Promise<string | null> {
  for (const q of queries) {
    const url = await pexels(q) || await wikimedia(q)
    if (url) return url
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ urls: [null, null, null] })

    const city = location?.split(',')[0]?.trim() || location || ''

    const [room, exterior, destination] = await Promise.all([
      best([
        `${name} hotel room interior`,
        `luxury hotel room ${city}`,
        `hotel bedroom suite`,
      ]),
      best([
        `${name} hotel exterior`,
        `${name} resort ${city}`,
        `luxury hotel exterior ${city}`,
      ]),
      best([
        `${city} travel destination`,
        `${location} tourism`,
        `${city} city landscape`,
      ]),
    ])

    return NextResponse.json({ urls: [room, exterior, destination] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ urls: [null, null, null], error: msg }, { status: 500 })
  }
}
