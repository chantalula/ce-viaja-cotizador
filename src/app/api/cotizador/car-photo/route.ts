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

async function wikipedia(model: string): Promise<string | null> {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(model)}&srlimit=3&format=json`,
      { headers: { 'User-Agent': 'CEViajaCotizador/1.0 (chantalula@gmail.com)' } }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const results: { title: string }[] = searchData.query?.search || []
    for (const result of results) {
      const pageRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(result.title)}&prop=pageimages&format=json&pithumbsize=1200`,
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
    const { model, category } = await request.json() as { model: string; category: string }
    const query = model?.trim() || category?.trim()
    if (!query) return NextResponse.json({ url: null })

    // Strip "o similar" / "or similar" suffix common in rental docs
    const cleanModel = query.replace(/\s*(o similar|or similar)\s*/i, '').trim()

    const url =
      await pexels(`${cleanModel} white background`)
      ?? await pexels(`${cleanModel} car studio`)
      ?? await wikipedia(cleanModel)
      ?? await pexels(`${category} car white background`)
      ?? await pexels('car white background studio')

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
