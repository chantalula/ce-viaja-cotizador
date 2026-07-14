import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(request: NextRequest) {
  try {
    const { name, location } = await request.json() as { name: string; location: string }
    if (!name?.trim()) return NextResponse.json({ urls: [null, null, null] })

    const city = (location || '').split(',')[0].trim()

    const [room, exterior, map] = await Promise.all([
      // Slot 1: habitación — busca específicamente interiores
      pexels(`${name} hotel bedroom interior`).then(u => u ?? pexels('luxury hotel room interior suite')),
      // Slot 2: exterior — busca fachada o piscina del hotel (page 2 para evitar duplicar)
      pexels(`${city} resort hotel pool exterior`).then(u => u ?? pexels('resort hotel exterior facade', 2)),
      // Slot 3: mapa real del hotel via Nominatim + Carto tiles
      hotelMapTile(name, location).then(u => u ?? pexels(`${city} aerial view map`)),
    ])

    return NextResponse.json({ urls: [room, exterior, map] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ urls: [null, null, null], error: msg }, { status: 500 })
  }
}
