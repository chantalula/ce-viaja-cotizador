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
    const { name, location } = await request.json() as { name: string; location: string }
    const n = (name || '').trim()
    const l = (location || '').trim()
    if (!n && !l) return NextResponse.json({ url: null })

    const queries: string[] = []
    if (n && l) queries.push(`${n} ${l} tour`)
    if (l) queries.push(`${l} tourism landmark attraction`)
    if (n) queries.push(`${n} excursion sightseeing`)
    if (l) queries.push(`${l} travel destination`)
    queries.push('tour excursion travel landmark')

    let url: string | null = null
    for (const q of queries) {
      url = await pexels(q)
      if (url) break
    }

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
