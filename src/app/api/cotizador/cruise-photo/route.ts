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

async function wikipedia(searchTerm: string): Promise<string | null> {
  try {
    const slug = searchTerm.trim().replace(/\s+/g, '_')
    const directRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(slug)}&prop=pageimages&format=json&pithumbsize=2000`,
      { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
    )
    if (directRes.ok) {
      const d = await directRes.json()
      const pages = d.query?.pages
      if (pages) {
        const page = Object.values(pages)[0] as { thumbnail?: { source: string }; missing?: string }
        if (!page.missing && page?.thumbnail?.source) return page.thumbnail.source
      }
    }

    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm + ' cruise ship')}&srlimit=3&format=json`,
      { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const results: { title: string }[] = searchData.query?.search || []
    for (const result of results) {
      const pageRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(result.title)}&prop=pageimages&format=json&pithumbsize=2000`,
        { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
      )
      if (!pageRes.ok) continue
      const pageData = await pageRes.json()
      const pages = pageData.query?.pages
      if (!pages) continue
      const page = Object.values(pages)[0] as { thumbnail?: { source: string } }
      if (page?.thumbnail?.source) return page.thumbnail.source
    }
    return null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  try {
    const { ship, line } = await request.json() as { ship: string; line: string }
    if (!ship?.trim()) return NextResponse.json({ url: null })

    const year = new Date().getFullYear()
    const shipClean = ship.trim()
    const lineClean = (line || '').trim()

    // Ship exterior: Wikipedia first (most accurate), then Pexels with year
    const url =
      await wikipedia(shipClean)
      ?? await pexels(`${shipClean} cruise ship ${year}`)
      ?? await pexels(`${lineClean} ${shipClean} cruise ship`)
      ?? await pexels(`cruise ship ${year} ocean`)

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
