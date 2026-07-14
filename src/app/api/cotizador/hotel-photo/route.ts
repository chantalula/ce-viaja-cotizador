import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

async function tryFetchOgImage(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CEViaja/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (!ogMatch?.[1]) return null
    const imgUrl = ogMatch[1]
    if (imgUrl.startsWith('http')) return imgUrl
    const base = new URL(websiteUrl)
    return new URL(imgUrl, base.origin).href
  } catch { return null }
}

async function tryWikimediaCommons(query: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=10&format=json&origin=*`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!searchRes.ok) return null
    const data = await searchRes.json()
    const files: { title: string }[] = data.query?.search || []
    for (const file of files) {
      const imgRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(file.title)}&prop=imageinfo&iiprop=url&iiurlwidth=1600&format=json&origin=*`,
        { signal: AbortSignal.timeout(4000) }
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

async function tryUnsplashFallback(query: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(query)
    const res = await fetch(`https://source.unsplash.com/featured/1400x900/?${encoded}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    })
    if (res.ok && res.url && res.url.includes('images.unsplash.com')) return res.url
    return null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ url: null })

    // Step 1: Ask Claude for hotel info — website URL and any known image URL
    const claudeMsg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Hotel: "${name}" en ${location || 'destino desconocido'}.
Dame la siguiente info en JSON válido sin markdown:
{
  "website": "<URL oficial del hotel o cadena hotelera, ej: https://www.marriott.com/hotels/travel/...>",
  "imageUrl": "<URL directa de una imagen pública del hotel si la conoces, o null>",
  "searchTerms": "<términos de búsqueda en inglés para encontrar fotos de este hotel en Wikimedia Commons>"
}
Solo JSON, nada más.`,
      }],
    })

    const raw = claudeMsg.content[0]?.type === 'text' ? claudeMsg.content[0].text.trim() : ''
    let hotelInfo: { website?: string; imageUrl?: string; searchTerms?: string } = {}
    try {
      const a = raw.indexOf('{'); const b = raw.lastIndexOf('}')
      if (a >= 0 && b > a) hotelInfo = JSON.parse(raw.slice(a, b + 1))
    } catch { /* ignore */ }

    // Step 2: Try direct image URL from Claude
    if (hotelInfo.imageUrl) {
      try {
        const check = await fetch(hotelInfo.imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
        if (check.ok && check.headers.get('content-type')?.startsWith('image/')) {
          return NextResponse.json({ url: hotelInfo.imageUrl })
        }
      } catch { /* continue */ }
    }

    // Step 3: Try og:image from hotel's official website
    if (hotelInfo.website) {
      const ogUrl = await tryFetchOgImage(hotelInfo.website)
      if (ogUrl) return NextResponse.json({ url: ogUrl })
    }

    // Step 4: Wikimedia Commons with Claude's search terms
    const wikiQuery = hotelInfo.searchTerms || `${name} ${location} hotel`
    const wikimediaUrl = await tryWikimediaCommons(wikiQuery)
    if (wikimediaUrl) return NextResponse.json({ url: wikimediaUrl })

    // Step 5: Also try with the original name+location
    if (hotelInfo.searchTerms) {
      const wikimediaUrl2 = await tryWikimediaCommons(`${name} ${location} hotel exterior`)
      if (wikimediaUrl2) return NextResponse.json({ url: wikimediaUrl2 })
    }

    // Step 6: Unsplash visual fallback (no API key needed)
    const unsplashQuery = `hotel ${name} ${location}`
    const unsplashUrl = await tryUnsplashFallback(unsplashQuery)
    if (unsplashUrl) return NextResponse.json({ url: unsplashUrl })

    // Step 7: Generic hotel destination photo from Unsplash
    const genericUrl = await tryUnsplashFallback(`luxury hotel ${location || 'travel'}`)
    return NextResponse.json({ url: genericUrl })

  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
