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

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ url: null })

    // Step 1: Ask Claude for optimized search terms
    let searchTerms = `${name} hotel ${location}`
    try {
      const claudeMsg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Hotel: "${name}" en "${location || 'destino'}". Dame los mejores términos de búsqueda en inglés para encontrar fotos bonitas de este hotel específico en Pexels o Wikimedia Commons. Solo devuelve los términos, sin explicaciones. Ejemplo: "Marriott Cancun beachfront resort exterior"`,
        }],
      })
      const terms = claudeMsg.content[0]?.type === 'text' ? claudeMsg.content[0].text.trim() : ''
      if (terms) searchTerms = terms
    } catch { /* use default */ }

    // Step 2: Pexels with Claude's terms (primary — needs PEXELS_API_KEY in env)
    const pexels1 = await searchPexels(searchTerms)
    if (pexels1) return NextResponse.json({ url: pexels1 })

    // Step 3: Pexels with generic hotel + location fallback
    const pexels2 = await searchPexels(`hotel ${location} luxury resort`)
    if (pexels2) return NextResponse.json({ url: pexels2 })

    // Step 4: Wikimedia Commons
    const wiki = await searchWikimediaCommons(searchTerms)
    if (wiki) return NextResponse.json({ url: wiki })

    // Step 5: Wikimedia Commons generic
    const wiki2 = await searchWikimediaCommons(`${name} hotel exterior`)
    if (wiki2) return NextResponse.json({ url: wiki2 })

    return NextResponse.json({ url: null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
