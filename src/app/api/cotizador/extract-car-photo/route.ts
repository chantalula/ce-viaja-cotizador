import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { image, mimeType } = await request.json() as { image: string; mimeType: string }
    if (!image) return NextResponse.json({ x: 0, y: 0, w: 1, h: 1 })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: image },
          },
          {
            type: 'text',
            text: 'This is a car rental confirmation document (Alamo, Dollar, Hertz, Budget, etc.). Look for a car image, photo, illustration, or silhouette of the vehicle — it is usually a small rectangular image showing the car or car category. Return ONLY a JSON: {"found":true,"x":0.0,"y":0.0,"w":0.0,"h":0.0} with decimal fractions (0.0–1.0) of the image dimensions for x (left), y (top), w (width), h (height) of JUST the car image area. If there is NO car image at all in the document, return {"found":false,"x":0,"y":0,"w":1,"h":1}.',
          },
        ],
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const a = text.indexOf('{')
    const b = text.lastIndexOf('}')
    if (a < 0 || b < 0) return NextResponse.json({ found: false, x: 0, y: 0, w: 1, h: 1 })
    const bbox = JSON.parse(text.slice(a, b + 1)) as { found: boolean; x: number; y: number; w: number; h: number }
    if (!bbox.found) return NextResponse.json({ found: false, x: 0, y: 0, w: 1, h: 1 })
    return NextResponse.json({
      found: true,
      x: Math.max(0, Math.min(0.95, bbox.x ?? 0)),
      y: Math.max(0, Math.min(0.95, bbox.y ?? 0)),
      w: Math.max(0.05, Math.min(1, bbox.w ?? 0.3)),
      h: Math.max(0.05, Math.min(1, bbox.h ?? 0.2)),
    })
  } catch {
    return NextResponse.json({ x: 0, y: 0, w: 1, h: 1 })
  }
}
