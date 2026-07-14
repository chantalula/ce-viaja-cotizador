import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres el asistente de edición del cotizador de CE Viaja. Recibes la cotización actual en JSON, una instrucción en lenguaje natural, y opcionalmente imágenes o PDFs adjuntos. Debes devolver SOLO un objeto JSON con dos campos:
{"quote": <cotización completa actualizada>, "message": "<qué hiciste, en español, máximo 1 oración>"}

La cotización tiene esta estructura:
{
  "number": string, "date": string, "validez": string,
  "client": string, "clientPhone": string, "clientEmail": string, "clientPassport": string, "clientId": string,
  "cabin": string, "currency": string, "sellerIndex": number,
  "taxes": number, "priceAdulto": number, "priceNino": number, "priceJubilado": number, "priceInfante": number,
  "comments": string,
  "pax": [{"name": string, "type": "Adulto"|"Niño"|"Jubilado"|"Infante", "cabin": string}],
  "items": [...]
}

Tipos de items posibles:
VUELO: {"type":"flight","dir":"Ida"|"Vuelta"|"Tramo interno","date":"Jue 21 may 2026","price":0,"baggage":"","segments":[{"airline":"","flightNo":"","alliance":"—","from":"","fromCity":"","dep":"","to":"","toCity":"","arr":"","plus":"","duration":"","aircraft":"","cabin":"Económica","connectionAfter":""}]}
HOTEL: {"type":"hotel","name":"","location":"","address":"","checkIn":"","checkOut":"","nights":"","roomType":"","board":"","cancellation":"Tarifa no reembolsable"|"Permite cancelación"|"","price":0}
CRUCERO: {"type":"cruise","line":"","ship":"","route":"","depart":"","nights":"","cabin":"","cabinLabel":"","boardingTime":"","ports":[],"promotion":"","price":0}
TOUR: {"type":"tour","name":"","location":"","date":"","duration":"","includes":"","price":0}
TRASLADO: {"type":"transfer","from":"","to":"","date":"","vehicle":"","mode":"Privado","price":0}
CARRO: {"type":"car","category":"","model":"","pickupLocation":"","dropoffLocation":"","pickupDate":"","returnDate":"","days":"","passengers":"5","bags":"2","doors":"4","ac":"Sí","transmission":"Automático","protection":"","promotion":"","price":0}

Reglas:
- Si hay imágenes o PDFs adjuntos, analízalos y extrae información relevante para aplicar a la cotización según la instrucción.
- Devuelve el JSON completo de la cotización con TODOS los campos, no solo los que cambiaron.
- FOTOS: las fotos se buscan automáticamente según estos campos — NO hay campo de URL de foto en el JSON:
  * Foto del barco (crucero): se busca por el campo "ship". Si piden foto del barco, asegúrate que "ship" tenga el nombre correcto.
  * Foto del destino/puerto (crucero): se busca por el nombre del PRIMER puerto en "ports[0].port". Si piden foto de un destino, agrega o actualiza el primer puerto con ese lugar.
  * Foto del carro: se busca por el campo "model". Si piden foto del carro, asegúrate que "model" tenga el modelo correcto.
- Si la instrucción pide la dirección de un hotel o el campo "address" está vacío y conoces la dirección, complétala con tu propio conocimiento.
- Si la instrucción pide agregar un comentario o nota, ponlo en el campo "comments".
- Si pide quitar algo, elimínalo del array items.
- Si pide cambiar un precio, actualiza el campo correspondiente.
- Mantén todos los campos existentes que no se mencionen en la instrucción.
- NUNCA respondas que algo no se puede hacer por ser "visual".
- Devuelve SOLO el JSON, sin markdown ni explicaciones fuera del JSON.`

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const quoteStr = formData.get('quote') as string
    const instruction = (formData.get('instruction') as string) || ''
    const files = formData.getAll('files') as File[]

    if (!quoteStr) return NextResponse.json({ error: 'Falta la cotización.' }, { status: 400 })
    if (!instruction.trim() && files.length === 0) {
      return NextResponse.json({ error: 'Escribe una instrucción o adjunta un archivo.' }, { status: 400 })
    }

    const content: Anthropic.MessageParam['content'] = []

    // Attach files first
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mime = file.type || 'application/octet-stream'
      if (IMAGE_TYPES.includes(mime)) {
        content.push({ type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } })
      } else if (mime === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as unknown as Anthropic.TextBlockParam)
      }
    }

    content.push({
      type: 'text',
      text: `Cotización actual:\n${quoteStr}\n\nInstrucción: ${instruction || 'Analiza los archivos adjuntos y aplica los cambios que correspondan a la cotización.'}`,
    })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    const a = raw.indexOf('{')
    const b = raw.lastIndexOf('}')
    if (a < 0 || b < 0) {
      return NextResponse.json({ error: 'La IA no pudo procesar la instrucción.' }, { status: 422 })
    }
    const parsed = JSON.parse(raw.slice(a, b + 1))
    return NextResponse.json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    return NextResponse.json({ error: msg || 'Error al procesar.' }, { status: 500 })
  }
}
