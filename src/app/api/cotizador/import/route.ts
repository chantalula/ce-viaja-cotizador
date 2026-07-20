import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres asistente de una agencia de viajes. Los archivos pueden ser CUALQUIERA de estos documentos: itinerarios de vuelos (Sabre/PNR), páginas de pasaporte, cotizaciones de hotel, crucero, tour, traslado, alquiler de carro (Alamo, Dollar, Hertz, Budget, Avis, Enterprise, National, Thrifty, etc.), seguros de viaje, o capturas de precios. Pueden venir varios archivos a la vez — analiza TODOS y combina la información en un solo JSON. Devuelve SOLO un JSON válido, sin explicaciones ni markdown:
{"client":"","clientPhone":"","clientEmail":"","clientPassport":"","pax":[{"name":"APELLIDO / NOMBRE","type":"Adulto","cabin":"Económica"}],"taxes":0,"priceAdulto":0,"priceNino":0,"priceJubilado":0,"items":[]}
Cada elemento de "items":
VUELO: {"type":"flight","dir":"Ida","date":"Jue 21 may 2026","price":0,"baggage":"","segments":[{"airline":"","flightNo":"","alliance":"—","from":"","fromCity":"","dep":"","to":"","toCity":"","arr":"","plus":"","duration":"","aircraft":"","cabin":"Económica","connectionAfter":""}]}
HOTEL: {"type":"hotel","name":"","stars":0,"location":"","address":"","checkIn":"","checkOut":"","nights":"","roomType":"","board":"","cancellation":"","price":0}
CRUCERO: {"type":"cruise","line":"","ship":"","route":"","depart":"","nights":"","cabin":"","cabinLabel":"","boardingTime":"","ports":[{"date":"","port":"","arr":"","dep":""}],"promotion":"","price":0}
TOUR: {"type":"tour","name":"","location":"","date":"","duration":"","includes":"","price":0}
TRASLADO: {"type":"transfer","from":"","to":"","date":"","vehicle":"","mode":"Privado","price":0}
CARRO: {"type":"car","company":"","category":"","model":"","pickupLocation":"","pickupCode":"","pickupDate":"","pickupTime":"","dropoffLocation":"","returnCode":"","returnDate":"","returnTime":"","days":"","passengers":"5","bags":"2","doors":"4","ac":"Sí","transmission":"Automático","protection":"","promotion":"","price":0}
Reglas:
- PASAPORTE: llena "client", "clientPassport" y agrega a "pax". No inventes vuelos.
- "client": nombre del titular o grupo. NUNCA el código de reservación.
- DOCUMENTOS CE VIAJA: Los itinerarios preparados por CE Viaja pueden tener secciones "OTROS" o "NOTAS" al final que contienen solo despedidas ("GRACIAS", "FELIZ VIAJE", "RECUERDE REVISAR VISA", etc.). IGNORA completamente esas secciones — no crees ningún item de viaje para ellas. El campo "PREPARADO PARA" indica el nombre del cliente (va en "client"), no es un pasajero de vuelo.
- Precios numéricos sin símbolo ni comas. Moneda USD. IMPORTANTE: el precio de cada item (vuelo, hotel, carro, crucero, tour, traslado, seguro) va SIEMPRE en el campo "price" de ese item. Los campos "priceAdulto", "priceNino", "priceJubilado" son SOLO para cuando el documento muestra precios desglosados por tipo de pasajero para vuelos o cruceros. El campo "taxes" es para impuestos generales del itinerario. NUNCA pongas el precio de un carro o hotel en "priceAdulto".
- Horas en formato 24h (HH:MM). Conversión AM/PM: 12AM→00, 1AM→01, 6AM→06, 11AM→11, 12PM→12, 1PM→13, 2PM→14, 3PM→15, 4PM→16, 5PM→17, 6PM→18, 7PM→19, 8PM→20, 9PM→21, 10PM→22, 11PM→23. Ejemplo: "4:07 PM" → "16:07", "8:30 AM" → "08:30", "12:00 AM" → "00:00".
- "Economy"/"Turista"="Económica"; "Business"="Ejecutiva".
- Alianza por aerolínea — Star Alliance: United(UA), Lufthansa(LH), Air Canada(AC), Singapore(SQ), ANA(NH), Turkish(TK), Swiss(LX), Austrian(OS), TAP(TP), LOT(LO), Avianca(AV), Copa(CM), Ethiopian(ET), Egyptair(MS), EVA Air(BR), Air China(CA), Air India(AI), Air New Zealand(NZ), Asiana(OZ), SAS(SK), Shenzhen(ZH), South African(SA), Aegean(A3), Croatia(OU), Juneyao(HO). SkyTeam: Delta(DL), Air France(AF), KLM(KL), Korean Air(KE), China Eastern(MU), China Southern(CZ), Aeromexico(AM), ITA Airways(AZ), Vietnam(VN), Air Europa(UX), Middle East(ME), Garuda(GA), Kenya(KQ), TAROM(RO), Xiamen(MF), Czech(OK). oneworld: American(AA), British Airways(BA), Iberia(IB), Cathay Pacific(CX), Qantas(QF), Japan Airlines(JL), Finnair(AY), Qatar(QR), Malaysia(MH), Royal Jordanian(RJ), Royal Air Maroc(AT), Alaska(AS), SriLankan(UL), Fiji(FJ). Sin alianza (pon "—"): LATAM(LA), Ryanair(FR), easyJet(U2), WestJet(WS), JetBlue(B6), Spirit(NK), Frontier(F9), Volaris(Y4), VivaAerobus(VB), Wingo(P5), Arajet(DM), Sky Airline(H2), Flybondi(FO), Azul(AD), GOL(G3), Interjet, Southwest(WN), Allegiant(G4), Sun Country(SY), Sunwing(WG), Caribbean(BW), Conviasa(V0), Surinam(PY), Air Transat(TS).
- Vuelos: crea UN item por trayecto independiente. Agrupa en el mismo item SOLO segmentos que son escala del mismo viaje (mismo PNR/reservación, conexión corta entre ellos). Si son dos vuelos One Way distintos, dos reservaciones diferentes, o trayectos con días de diferencia, crea un item separado por cada uno. dir: "Ida"=primer trayecto, "Vuelta"=regreso, "Tramo interno"=vuelo interno adicional.
- "connectionAfter" del segmento i = tiempo de escala entre arr[i] y dep[i+1] en el mismo aeropuerto, formato "Conexión en <ciudad> · <Xh Ym>". El último segmento siempre tiene connectionAfter="". Calcula restando arr[i] de dep[i+1] (misma zona horaria, si da negativo suma 24h).
- CRUCERO: "line"=naviera (ej: "Royal Caribbean"), "ship"=nombre del barco, "route"=nombre del itinerario, "depart"=fecha de salida en español corto, "nights"=número de noches, "cabin"=código exacto del camarote tal como aparece en el documento (ej: "XQ-GTY OCEAN VIEW BALCONY QUAD GTY"), "cabinLabel"=descripción en español del tipo de camarote basada en el código (ej: "Balcón Vista al Mar para 4 personas" / "Interior Doble" / "Suite con Terraza"), "boardingTime"=hora de embarque en 24h (ej: "10:30 - 14:30"), "ports"=array de puertos día a día con {"date":"07 ago 2026","port":"ORLANDO (PORT CANAVERAL), FL","arr":"","dep":"16:00"} (arr vacío en primer puerto, dep vacío en último), "promotion"=promociones aplicadas (ej: "Last Minute NRD"), "price"=total a pagar.
- HOTEL: "name"=nombre exacto del hotel, "stars"=número de estrellas del hotel (1-5, o 0 si no se menciona), "location"=ciudad y país (ej: "Cancún, México"), "address"=dirección física del hotel. Si no aparece en el documento, usa tu propio conocimiento para completarla (ej: "Blvd. Kukulcán Km 9.5, Zona Hotelera, Cancún"). Siempre intenta llenar este campo. "checkIn"/"checkOut"=fechas en español corto, "nights"=número de noches como texto, "roomType"=tipo de habitación (ej: "Habitación Doble Estándar", "Suite Junior"), "board"=régimen de comidas (ej: "Todo Incluido", "Solo Desayuno", "Solo Alojamiento"), "cancellation"=si el documento indica que es no reembolsable o sin reembolso usa exactamente "Tarifa no reembolsable"; si permite cancelación o tiene cancelación gratuita usa exactamente "Permite cancelación"; si no se menciona deja "","price"=precio TOTAL de la estadía completa (no por noche). Si el documento muestra precio por noche, multiplícalo por el número de noches. Si muestra precio por habitación o por persona, usa ese total. Busca cualquier valor que diga "total", "precio", "rate", "importe", "amount" o similar.
- CARRO: Para documentos de arrendadora de autos busca AGRESIVAMENTE estos datos:
  "company"= mira el encabezado, logo, pie de página, URL o dominio del email: Alamo, Dollar, Hertz, Budget, Avis, Enterprise, National, Thrifty, Sixt, Fox, Payless, ACE, Europcar.
  "category"= clase del vehículo (Economy, Compact, Intermediate, Full Size, SUV, Minivan, etc.)
  "model"= modelo específico como "Hyundai Elantra o similar", "Chevrolet Equinox o similar"
  "pickupLocation"/"dropoffLocation"= nombre del aeropuerto o dirección de recogida/devolución
  "pickupCode"/"returnCode"= código IATA de 3 letras del aeropuerto si la recogida/devolución es en un aeropuerto (ej: "LAS", "MIA", "JFK", "PTY"). Deja "" si no es aeropuerto.
  "pickupDate"/"returnDate"= fechas en español corto (ej: "Lun 21 jul 2026")
  "pickupTime"/"returnTime"= hora de recogida y hora de devolución en formato 24h (ej: "10:00", "14:30"). Busca campos como "Pick-up Time", "Return Time", "Hora de recogida", "Hora de devolución", horarios junto a la fecha.
  "days"= número de días de renta
  "protection"= tipo de protección incluida (CDW, LDW, LIS, PAI, etc.)
  ⚠️ CARRO — REGLAS ABSOLUTAS:
  1. El precio va ÚNICAMENTE en items[n].price. NUNCA en priceAdulto, priceNino, priceJubilado — esos campos son SOLO para vuelos/cruceros. Para carro siempre pon priceAdulto:0, priceNino:0, priceJubilado:0.
  2. Un alquiler de carro NO tiene pasajeros con nombre. Pon "pax":[] (array vacío) cuando el documento sea solo de carro.
  3. Para encontrar el precio busca: "Estimated Total", "Total Charges", "Amount Due", "Grand Total", "Total Due", "Charge Total", "Total Estimated", "Precio Total". Si solo hay tarifa por día multiplícala por los días.
  CORRECTO: {"pax":[],"priceAdulto":0,"priceNino":0,"priceJubilado":0,"items":[{"type":"car","price":523.45}]}
  INCORRECTO: {"pax":[{"name":"Driver","type":"Adulto"}],"priceAdulto":523.45,"items":[{"type":"car","price":0}]}
- Fechas en español corto: "Jue 21 may 2026". Deja "" o 0 lo que no aparezca.
- "duration": déjalo SIEMPRE como "" (cadena vacía). El sistema calcula la duración correcta con cambio de horario automáticamente. EXCEPCIÓN: si la duración aparece explícita en el documento (ej: "9h 45m", "Flight time 10:20"), úsala tal cual en formato "Xh Ym".`

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_TOTAL_MB = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const text = formData.get('text') as string | null
    const files = formData.getAll('files') as File[]

    const content: Anthropic.MessageParam['content'] = []
    let totalBytes = 0

    if (files.length > 0) {
      for (const file of files) {
        totalBytes += file.size
        if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
          return NextResponse.json(
            { error: `El total de archivos supera los ${MAX_TOTAL_MB} MB permitidos.` },
            { status: 400 }
          )
        }

        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        const mime = file.type || 'application/octet-stream'

        if (IMAGE_TYPES.includes(mime)) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          })
        } else if (mime === 'application/pdf') {
          content.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          } as unknown as Anthropic.TextBlockParam)
        } else {
          // .txt, .doc, .docx — leer como texto plano
          const decoded = Buffer.from(buffer).toString('utf-8').replace(/\0/g, ' ')
          content.push({ type: 'text', text: `Archivo "${file.name}":\n${decoded}` })
        }
      }

      content.push({
        type: 'text',
        text: files.length > 1
          ? 'Analiza todos los archivos anteriores y combina la información en un solo JSON.'
          : 'Analiza este archivo y extrae los datos de viaje.',
      })
    } else if (text?.trim()) {
      content.push({ type: 'text', text: `Documento:\n${text}` })
    } else {
      return NextResponse.json({ error: 'Sube al menos un archivo o pega el texto.' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    let raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
    let a = raw.indexOf('{')
    let b = raw.lastIndexOf('}')

    // Retry once if response has no valid JSON
    if (a < 0 || b < 0) {
      const retry = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content },
          { role: 'assistant', content: raw || '(respuesta vacía)' },
          { role: 'user', content: [{ type: 'text', text: 'Tu respuesta no contiene JSON válido. Devuelve ÚNICAMENTE el objeto JSON, empezando con { y terminando con }, sin explicaciones ni markdown.' }] },
        ],
      })
      raw = retry.content[0]?.type === 'text' ? retry.content[0].text.trim() : ''
      a = raw.indexOf('{')
      b = raw.lastIndexOf('}')
    }

    if (a < 0 || b < 0) {
      return NextResponse.json(
        { error: 'La IA no devolvió datos legibles. Prueba pegando el texto.' },
        { status: 422 }
      )
    }
    const parsed = JSON.parse(raw.slice(a, b + 1))
    return NextResponse.json(parsed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    const friendly = msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('billing')
      ? 'Créditos de IA insuficientes. Recarga tu cuenta en console.anthropic.com → Billing.'
      : msg || 'Error al procesar. Intenta pegando el texto manualmente.'
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
