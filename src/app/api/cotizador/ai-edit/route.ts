import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres el asistente de edición del cotizador de CE Viaja. Recibes la cotización actual en JSON y una instrucción en lenguaje natural. Debes devolver SOLO un objeto JSON con dos campos:
{"quote": <cotización completa actualizada>, "message": "<qué hiciste, en español, máximo 1 oración>"}

La cotización tiene esta estructura:
{
  "number": string, "date": string, "validez": string,
  "client": string, "clientPhone": string, "clientEmail": string, "clientPassport": string, "clientId": string,
  "cabin": string, "currency": string, "sellerIndex": number,
  "taxes": number, "priceAdulto": number, "priceNino": number, "priceJubilado": number,
  "comments": string,
  "pax": [{"name": string, "type": "Adulto"|"Niño"|"Jubilado", "cabin": string}],
  "items": [...]
}

Tipos de items posibles:
VUELO: {"type":"flight","dir":"Ida"|"Vuelta"|"Tramo interno","date":"Jue 21 may 2026","price":0,"baggage":"","segments":[{"airline":"","flightNo":"","alliance":"—","from":"","fromCity":"","dep":"","to":"","toCity":"","arr":"","plus":"","duration":"","aircraft":"","cabin":"Económica","connectionAfter":""}]}
HOTEL: {"type":"hotel","name":"","location":"","checkIn":"","checkOut":"","nights":"","roomType":"","board":"","price":0}
CRUCERO: {"type":"cruise","line":"","ship":"","route":"","depart":"","nights":"","cabin":"","cabinLabel":"","boardingTime":"","ports":[],"promotion":"","price":0}
TOUR: {"type":"tour","name":"","location":"","date":"","duration":"","includes":"","price":0}
TRASLADO: {"type":"transfer","from":"","to":"","date":"","vehicle":"","mode":"Privado","price":0}
CARRO: {"type":"car","category":"","model":"","pickupLocation":"","dropoffLocation":"","pickupDate":"","returnDate":"","days":"","passengers":"5","bags":"2","doors":"4","ac":"Sí","transmission":"Automático","protection":"","promotion":"","price":0}

Reglas:
- Devuelve el JSON completo de la cotización con TODOS los campos, no solo los que cambiaron.
- FOTOS: las fotos se buscan automáticamente según estos campos — NO hay campo de URL de foto en el JSON:
  * Foto del barco (crucero): se busca por el campo "ship". Si piden foto del barco, asegúrate que "ship" tenga el nombre correcto.
  * Foto del destino/puerto (crucero): se busca por el nombre del PRIMER puerto en "ports[0].port". Si piden foto de un destino, agrega o actualiza el primer puerto con ese lugar.
  * Foto del carro: se busca por el campo "model". Si piden foto del carro, asegúrate que "model" tenga el modelo correcto.
  * Foto del hotel: no se auto-busca, se sube manualmente.
- Si la instrucción pide foto de un destino de crucero y no hay puertos, agrega el destino como primer puerto en el array ports.
- Si la instrucción pide agregar un comentario o nota, ponlo en el campo "comments".
- Si pide quitar algo, elimínalo del array items.
- Si pide cambiar un precio, actualiza el campo correspondiente.
- Mantén todos los campos existentes que no se mencionen en la instrucción.
- NUNCA respondas que algo no se puede hacer por ser "visual" — las fotos siempre se controlan a través de los campos ship, model o ports[0].port.
- Devuelve SOLO el JSON, sin markdown ni explicaciones fuera del JSON.`

export async function POST(request: NextRequest) {
  try {
    const { quote, instruction } = await request.json()
    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'Escribe una instrucción.' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Cotización actual:\n${JSON.stringify(quote, null, 2)}\n\nInstrucción: ${instruction}`
      }],
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
