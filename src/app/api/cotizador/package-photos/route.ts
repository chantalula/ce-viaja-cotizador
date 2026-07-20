import { NextRequest, NextResponse } from 'next/server'

async function pexels(query: string, count = 3): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return []
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: key } }
    )
    if (!res.ok) return []
    const data = await res.json() as { photos?: { src: { large2x: string } }[] }
    return (data.photos || []).map(p => p.src.large2x)
  } catch { return [] }
}

export async function POST(request: NextRequest) {
  try {
    const { destination, name } = await request.json() as { destination: string; name: string }
    const year = new Date().getFullYear()

    const dest = (destination || '').trim()
    const pkgName = (name || '').trim()

    if (!dest && !pkgName) return NextResponse.json({ urls: [] })

    const query = dest || pkgName

    // Fetch 6 photos with varied queries so we get diversity
    const [set1, set2] = await Promise.all([
      pexels(`${query} ${year} travel tourism`, 3),
      pexels(`${query} vacation landscape`, 3),
    ])

    // Merge, deduplicate, cap at 6
    const merged = [...set1, ...set2]
    const unique = [...new Map(merged.map(u => [u, u])).values()].slice(0, 6)

    // Fallback if nothing found
    if (unique.length === 0) {
      const fallback = await pexels('travel vacation tourism', 3)
      return NextResponse.json({ urls: fallback })
    }

    return NextResponse.json({ urls: unique })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ urls: [], error: msg }, { status: 500 })
  }
}
