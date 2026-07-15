import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { image, mimeType } = await request.json() as { image: string; mimeType: string }
    if (!image) return NextResponse.json({ x: 0, y: 0, w: 1, h: 1 })

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: image },
          },
          {
            type: 'text',
            text: 'Find the car/vehicle photo thumbnail embedded in this rental document. Return ONLY a JSON with the crop region as decimal fractions of the total image size: {"x":0.0,"y":0.0,"w":1.0,"h":1.0} where x,y = top-left corner, w,h = width and height. If no car photo thumbnail is visible, return {"x":0,"y":0,"w":1,"h":1}.',
          },
        ],
      }],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    const a = text.indexOf('{')
    const b = text.lastIndexOf('}')
    if (a < 0 || b < 0) return NextResponse.json({ x: 0, y: 0, w: 1, h: 1 })
    const bbox = JSON.parse(text.slice(a, b + 1)) as { x: number; y: number; w: number; h: number }
    // Clamp values to valid range
    return NextResponse.json({
      x: Math.max(0, Math.min(1, bbox.x ?? 0)),
      y: Math.max(0, Math.min(1, bbox.y ?? 0)),
      w: Math.max(0.05, Math.min(1, bbox.w ?? 1)),
      h: Math.max(0.05, Math.min(1, bbox.h ?? 1)),
    })
  } catch {
    return NextResponse.json({ x: 0, y: 0, w: 1, h: 1 })
  }
}
