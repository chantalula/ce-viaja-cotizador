import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

async function searchPexels(query: string): Promise<string | null> {
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

async function searchWikimediaCommons(query: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=8&format=json`,
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

async function searchPexelsMultiple(queries: string[]): Promise<(string | null)[]> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return queries.map(() => null)

  return Promise.all(queries.map(async (query, i) => {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${i + 1}&orientation=landscape`,
        { headers: { Authorization: key } }
      )
      if (!res.ok) return null
      const data = await res.json() as { photos?: { src: { large2x: string } }[] }
      // Use a different result index per slot so photos don't repeat
      const photos = data.photos || []
      const pick = photos[Math.min(i, photos.length - 1)]
      return pick?.src?.large2x ?? null
    } catch { return null }
  }))
}

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ urls: [null, null, null] })

    // Step 1: Ask Claude for 3 search queries (room, exterior, destination)
    let queries = [
      `${name} hotel room interior ${location}`,
      `${name} hotel exterior ${location}`,
      `${location} destination travel`,
    ]
    try {
      const claudeMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Hotel: "${name}" en "${location || 'destino'}". Dame 3 términos de búsqueda en inglés para Pexels, en JSON sin markdown:
{"room": "...", "exterior": "...", "destination": "..."}
- room: para buscar foto de habitación de este tipo de hotel
- exterior: para buscar la fachada o área del hotel
- destination: para buscar foto del destino/ciudad
Solo JSON.`,
        }],
      })
      const raw = claudeMsg.content[0]?.type === 'text' ? claudeMsg.content[0].text.trim() : ''
      const a = raw.indexOf('{'); const b = raw.lastIndexOf('}')
      if (a >= 0 && b > a) {
        const parsed = JSON.parse(raw.slice(a, b + 1)) as { room?: string; exterior?: string; destination?: string }
        queries = [
          parsed.room || queries[0],
          parsed.exterior || queries[1],
          parsed.destination || queries[2],
        ]
      }
    } catch { /* use defaults */ }

    // Step 2: Fetch all 3 photos in parallel from Pexels
    const pexelsResults = await searchPexelsMultiple(queries)

    // Step 3: Fill gaps with Wikimedia Commons
    const urls: (string | null)[] = await Promise.all(pexelsResults.map(async (url, i) => {
      if (url) return url
      const fallbackQuery = i === 2 ? `${location} travel destination` : `${name} ${location} hotel`
      return searchWikimediaCommons(fallbackQuery)
    }))

    return NextResponse.json({ urls })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ urls: [null, null, null], error: msg }, { status: 500 })
  }
}
