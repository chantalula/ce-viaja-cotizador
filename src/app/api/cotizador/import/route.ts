import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

const SYSTEM_PROMPT = `Eres asistente de una agencia de viajes. Los archivos pueden ser itinerarios de viaje (de una o varias páginas), reservaciones de vuelo (Sabre/PNR), pasaportes, cotizaciones de hotel, crucero, tour, traslado, alquiler de carro, seguros, o capturas de precios. Pueden venir varios archivos a la vez — analiza TODOS y combina la información en un solo JSON. Devuelve SOLO un JSON válido, sin explicaciones ni markdown:
{"client":"","clientPhone":"","clientEmail":"","clientPassport":"","pax":[{"name":"APELLIDO / NOMBRE","type":"Adulto","cabin":"Económica"}],"taxes":0,"priceAdulto":0,"priceNino":0,"priceJubilado":0,"items":[]}

⚠️ REGLA FUNDAMENTAL — ITINERARIOS COMPLETOS: Si el documento es un itinerario de paquete o viaje completo con múltiples servicios, debes extraer CADA servicio como su propio item separado en el array "items". NO hay límite de items — extrae TODO lo que encuentres: cada vuelo, cada hotel, cada traslado, cada tour, cada actividad, cada renta de carro. NUNCA colapses múltiples servicios en un solo item PAQUETE cuando tengas los detalles individuales disponibles.

Esquemas de items:
DÍA: {"type":"day","number":1,"date":"Mar 15 jul 2025","title":"Llegada a Cancún"}
VUELO: {"type":"flight","dir":"Ida","date":"Jue 21 may 2026","price":0,"baggage":"","segments":[{"airline":"","flightNo":"","alliance":"—","from":"","fromCity":"","dep":"","to":"","toCity":"","arr":"","plus":"","duration":"","aircraft":"","cabin":"Económica","connectionAfter":""}]}
HOTEL: {"type":"hotel","name":"","stars":0,"location":"","address":"","checkIn":"","checkOut":"","nights":"","roomType":"","board":"","cancellation":"","price":0}
CRUCERO: {"type":"cruise","line":"","ship":"","route":"","depart":"","nights":"","cabin":"","cabinLabel":"","boardingTime":"","ports":[{"date":"","port":"","arr":"","dep":""}],"promotion":"","price":0}
TOUR: {"type":"tour","name":"","location":"","date":"","duration":"","includes":"","price":0}
TRASLADO: {"type":"transfer","from":"","to":"","date":"","pickupTime":"","vehicle":"","passengers":"","description":"","mode":"Privado","price":0}
CARRO: {"type":"car","company":"","category":"","model":"","pickupLocation":"","pickupCode":"","pickupAddress":"","pickupDate":"","pickupTime":"","dropoffLocation":"","returnCode":"","returnAddress":"","returnDate":"","returnTime":"","days":"","passengers":"5","bags":"2","doors":"4","ac":"Sí","transmission":"Automático","protection":"","promotion":"","price":0}
PAQUETE: {"type":"package","name":"","destination":"","startDate":"","endDate":"","duration":"","includes":"","description":"","promotion":"","price":0}

Reglas por tipo:
- DÍA: Para itinerarios organizados por días, inserta un item DÍA antes de cada grupo de actividades del mismo día. "number"=número del día en el itinerario (1, 2, 3…), "date"=fecha del día en español corto (ej: "Mar 15 jul 2025"), "title"=descripción corta del día (ej: "Llegada a Cancún", "Día libre en París", "Excursión a Chichen Itzá", "Regreso"). Esto es OBLIGATORIO para documentos de paquetes o itinerarios multi-día: cada día debe tener su encabezado DÍA seguido de todos sus servicios (vuelos, traslados, hotel, tours, etc.).
- PASAPORTE: llena "client", "clientPassport" y agrega a "pax". No inventes vuelos.
- "client": nombre del titular o grupo. NUNCA el código de reservación.
- DOCUMENTOS CE VIAJA: secciones "OTROS" o "NOTAS" al final con despedidas ("GRACIAS", "FELIZ VIAJE", etc.) — IGNÓRALAS. "PREPARADO PARA" = nombre del cliente (va en "client"), no es pasajero.
- PAQUETE: Úsalo ÚNICAMENTE cuando el documento es una brochure o resumen de paquete SIN vuelos/hoteles/traslados específicos — solo describe lo que incluye en general y el precio total. Si el documento tiene vuelos con números de vuelo, hoteles con fechas, traslados con horarios, tours específicos, etc., extráelos TODOS como items individuales (VUELO, HOTEL, TRASLADO, TOUR, CARRO) y NO uses PAQUETE.
- VUELOS: crea UN item por trayecto independiente. Agrupa en el mismo item SOLO segmentos que son escala del mismo viaje (mismo PNR, conexión corta). Si son vuelos One Way distintos, reservaciones diferentes, o trayectos con días de diferencia, crea item separado por cada uno. dir: "Ida"=primer trayecto, "Vuelta"=regreso, "Tramo interno"=vuelo interno adicional.
- "connectionAfter" del segmento i = tiempo de escala entre arr[i] y dep[i+1], formato "Conexión en <ciudad> · <Xh Ym>". Último segmento siempre connectionAfter="".
- HOTEL: "name"=nombre exacto, "stars"=estrellas (1-5, 0 si no se menciona), "location"=ciudad y país, "address"=dirección física (usa tu conocimiento si no aparece), "checkIn"/"checkOut"=fechas en español corto, "nights"=número de noches, "roomType"=tipo de habitación, "board"=régimen (Todo Incluido/Solo Desayuno/Solo Alojamiento), "cancellation"="Tarifa no reembolsable" o "Permite cancelación" o "", "price"=precio TOTAL estadía completa.
- TRASLADO: "pickupTime"=hora en 24h, "vehicle"=tipo (ej: "Van privada", "Sedan ejecutivo"), "passengers"=capacidad, "description"=descripción para cliente (color, modelo, punto de encuentro).
- CRUCERO: "line"=naviera, "ship"=nombre del barco, "route"=itinerario, "depart"=fecha salida, "nights"=noches, "cabin"=código exacto del camarote, "cabinLabel"=descripción en español del camarote, "boardingTime"=hora embarque 24h, "ports"=array de puertos día a día, "promotion"=promociones, "price"=total.
- TOUR: extrae CADA tour o actividad como su propio item TOUR. "name"=nombre del tour, "location"=lugar, "date"=fecha, "duration"=duración, "includes"=qué incluye, "price"=precio.
- CARRO: busca AGRESIVAMENTE: "company"=arrendadora (Alamo/Dollar/Hertz/Budget/Avis/Enterprise/National/Thrifty/Sixt), "category"=clase, "model"=modelo específico, "pickupLocation"/"dropoffLocation"=lugar recogida/devolución, "pickupCode"/"returnCode"=IATA si es aeropuerto, "pickupAddress"/"returnAddress"=dirección física de la oficina, "pickupDate"/"returnDate"=fechas, "pickupTime"/"returnTime"=horas 24h, "days"=días, "protection"=tipo de protección.
  ⚠️ CARRO ABSOLUTO: precio SOLO en items[n].price, NUNCA en priceAdulto. pax:[] para documentos solo de carro.
- Precios: numéricos sin símbolo ni comas. "priceAdulto"/"priceNino"/"priceJubilado" SOLO para vuelos/cruceros con precios por pasajero. Precio de hotel/carro/tour/traslado siempre en item.price.
- Horas en 24h. AM/PM: 12AM→00, 1AM→01…11AM→11, 12PM→12, 1PM→13…11PM→23.
- "Economy"/"Turista"="Económica"; "Business"="Ejecutiva".
- Alianzas — Star Alliance: UA,LH,AC,SQ,NH,TK,LX,OS,TP,LO,AV,CM,ET,MS,BR,CA,AI,NZ,OZ,SK,ZH,SA,A3,OU,HO. SkyTeam: DL,AF,KL,KE,MU,CZ,AM,AZ,VN,UX,ME,GA,KQ,RO,MF,OK. oneworld: AA,BA,IB,CX,QF,JL,AY,QR,MH,RJ,AT,AS,UL,FJ. Sin alianza (pon "—"): LA,FR,U2,WS,B6,NK,F9,Y4,VB,P5,DM,H2,FO,AD,G3,WN,G4,SY,WG,BW,V0,PY,TS.
- Fechas en español corto: "Jue 21 may 2026". Deja "" o 0 lo que no aparezca.
- En segmentos de vuelo, "duration" déjalo "" salvo que aparezca explícita en el documento (ej: "9h 45m").`

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
