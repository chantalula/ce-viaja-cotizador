import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

async function pexels(query: string, page = 1): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=landscape`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return null
    const data = await res.json() as { photos?: { src: { large2x: string } }[] }
    return data.photos?.[0]?.src?.large2x ?? null
  } catch { return null }
}

async function hotelMapTile(name: string, location: string): Promise<string | null> {
  try {
    const q = location ? `${name}, ${location}` : name
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
    )
    if (!geoRes.ok) return null
    const geo = await geoRes.json() as { lat: string; lon: string }[]
    if (!geo.length) return null

    const lat = parseFloat(geo[0].lat)
    const lon = parseFloat(geo[0].lon)
    const zoom = 16

    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
    const latRad = lat * Math.PI / 180
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom))

    // Carto Voyager — free tiles, no API key, professional look
    return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}@2x.png`
  } catch { return null }
}

async function fetchStars(name: string, location: string): Promise<number> {
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Hotel: "${name}" en "${location}". ¿Cuántas estrellas tiene? Responde solo con un número del 1 al 5. Si no lo conoces responde 0.`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '0'
    const n = parseInt(text.replace(/\D/g, ''), 10)
    return isNaN(n) || n < 1 || n > 5 ? 0 : n
  } catch { return 0 }
}

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ urls: [null, null, null], stars: 0 })

    const city = (location || '').split(',')[0].trim()

    const [room, exterior, map, stars] = await Promise.all([
      pexels(`${name} hotel bedroom interior`).then(u => u ?? pexels('luxury hotel room interior suite')),
      pexels(`${city} resort hotel pool exterior`).then(u => u ?? pexels('resort hotel exterior facade', 2)),
      hotelMapTile(name, location).then(u => u ?? pexels(`${city} aerial view map`)),
      fetchStars(name, location),
    ])

    return NextResponse.json({ urls: [room, exterior, map], stars })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ urls: [null, null, null], stars: 0, error: msg }, { status: 500 })
  }
}
