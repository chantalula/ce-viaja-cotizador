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
    const { model, category } = await request.json() as { model: string; category: string }

    // Strip "o similar" / "or similar" suffix common in rental docs
    const cleanModel = (model || '').replace(/\s*(o similar|or similar)\s*/i, '').trim()
    const cleanCategory = (category || '').trim()
    const year = new Date().getFullYear()

    // Detect if model is a real car brand/model or just a category label
    const carBrands = ['hyundai','chevrolet','ford','toyota','honda','nissan','kia','jeep','mazda','volkswagen','vw','dodge','gmc','buick','cadillac','lincoln','chrysler','ram','subaru','mitsubishi','volvo','bmw','mercedes','audi','lexus','acura','infiniti','genesis','tesla','rivian','lucid','hertz','alamo','dollar','budget','avis','enterprise','national']
    const hasCarBrand = carBrands.some(b => cleanModel.toLowerCase().includes(b))

    let url: string | null = null

    if (hasCarBrand && cleanModel) {
      // We have a real model name — try specific queries first
      url =
        await pexels(`${cleanModel} ${year}`)
        ?? await pexels(`${cleanModel} car`)
        ?? await pexels(cleanModel)
    }

    if (!url && cleanCategory) {
      // Use category (e.g. "Intermediate SUV", "Compact", "Full Size")
      url =
        await pexels(`${cleanCategory} ${year} rental car`)
        ?? await pexels(`${cleanCategory} car`)
    }

    if (!url && cleanModel) {
      // Fallback: try model without brand filter
      url = await pexels(`${cleanModel} car`)
    }

    // Generic fallback — always returns something
    if (!url) {
      const genericCategory = cleanCategory || 'sedan'
      url = await pexels(`${genericCategory} car exterior`) ?? await pexels('rental car')
    }

    return NextResponse.json({ url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ url: null, error: msg }, { status: 500 })
  }
}
