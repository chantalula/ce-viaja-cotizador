'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  CRMClient,
  ClientForm,
  FlightItem,
  HotelItem,
  CruiseItem,
  CruisePort,
  TourItem,
  TransferItem,
  CarItem,
  InsuranceItem,
  QuoteDoc,
  QuoteItem,
  SavedQuote,
  Segment,
} from '@/lib/cotizador/types'
import { calcFlightDuration } from '@/lib/cotizador/flightDuration'

// ─── Constants ────────────────────────────────────────────────────────────────

const SELLERS = [
  { name: 'Sandra Missrie', phone: '+507 6070-8569', email: 'Ceviaja@hotmail.com', initials: 'SM' },
  { name: 'Manuel Finol', phone: '+507 6093-7798', email: 'Manuel@ceviaja.com', initials: 'MF' },
  { name: 'Esther Gonzalez', phone: '+507 6151-5700', email: 'Esther@ceviaja.com', initials: 'EG' },
  { name: 'Xenia de De Bello', phone: '+507 6202-4708', email: 'Xenia@ceviaja.com', initials: 'XB' },
  { name: 'Nanci Torres', phone: '+507 6151-5900', email: 'Nanci@ceviaja.com', initials: 'NT' },
  { name: 'Alejandra Delgado', phone: '+507 6140-8514', email: 'Adelgado@ceviaja.com', initials: 'AD' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  return 'CV-' + new Date().getFullYear() + '-' + String(n).padStart(3, '0')
}

function newSeg(): Segment {
  return {
    airline: '', flightNo: '', alliance: 'Star Alliance',
    from: '', fromCity: '', dep: '', to: '', toCity: '',
    arr: '', plus: '', duration: '', aircraft: '', cabin: 'Económica', connectionAfter: '',
  }
}

function newItem(type: string): QuoteItem {
  if (type === 'flight') return { type: 'flight', dir: 'Ida', date: '', price: 0, baggage: '1 maleta 23 kg + equipaje de mano', segments: [newSeg()] }
  if (type === 'hotel') return { type: 'hotel', name: 'Hotel', location: '', checkIn: '', checkOut: '', nights: '', roomType: '', board: '', price: 0 }
  if (type === 'cruise') return { type: 'cruise', line: '', ship: '', route: '', depart: '', nights: '', cabin: '', cabinLabel: '', boardingTime: '', ports: [], promotion: '', price: 0 }
  if (type === 'tour') return { type: 'tour', name: 'Tour', location: '', date: '', duration: '', includes: '', price: 0 }
  if (type === 'car') return { type: 'car', category: '', model: '', pickupLocation: '', dropoffLocation: '', pickupDate: '', returnDate: '', days: '', passengers: '5', bags: '2', doors: '4', ac: 'Sí', transmission: 'Automático', protection: 'Protección Total', promotion: '', price: 0 }
  if (type === 'insurance') return { type: 'insurance', company: '', plan: '', destination: '', startDate: '', endDate: '', days: '', coverage: '', price: 0 }
  return { type: 'transfer', from: '', to: '', date: '', vehicle: '', mode: 'Privado', price: 0 }
}

function seed(): QuoteDoc {
  return {
    number: 'CV-2025-0847',
    date: new Date().toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' }),
    validez: '24 horas',
    client: '', clientPhone: '', clientEmail: '', clientPassport: '', clientId: '',
    cabin: 'Económica',
    pax: [{ name: '', type: 'Adulto', cabin: 'Económica' }],
    currency: 'USD', sellerIndex: 0, taxes: 0,
    priceAdulto: 0, priceNino: 0, priceJubilado: 0, priceInfante: 0,
    items: [],
  }
}

function emptyClientForm(): ClientForm {
  return { name: '', phone: '', email: '', passport: '', photo: '', notes: '' }
}

function setPath(q: QuoteDoc, path: string, value: unknown): QuoteDoc {
  const clone: QuoteDoc = JSON.parse(JSON.stringify(q))
  const keys = path.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = clone
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]]
  obj[keys[keys.length - 1]] = value
  return clone
}

function totalOf(q: QuoteDoc) {
  const cnt = (t: string) => (q.pax || []).filter(p => p.type === t).length
  return cnt('Adulto')   * (Number(q.priceAdulto)   || 0)
       + cnt('Niño')     * (Number(q.priceNino)      || 0)
       + cnt('Jubilado') * (Number(q.priceJubilado)  || 0)
       + cnt('Infante')  * (Number(q.priceInfante)   || 0)
}

function productSummary(q: QuoteDoc) {
  const L: Record<string, string> = { flight: 'Vuelo', hotel: 'Hotel', cruise: 'Crucero', tour: 'Tour', transfer: 'Traslado', car: 'Carro', insurance: 'Seguro' }
  const c: Record<string, number> = {}
  ;(q.items || []).forEach(it => { c[it.type] = (c[it.type] || 0) + 1 })
  return Object.keys(c).map(k => c[k] + '× ' + L[k]).join(' · ') || '—'
}

function parseDurMin(s: string): number {
  const m = s.match(/(\d+)h(?:\s*(\d+)m)?/)
  if (!m) return 0
  return parseInt(m[1]) * 60 + parseInt(m[2] || '0')
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return h + 'h' + (m ? ' ' + m + 'm' : '')
}

function totalFlightDuration(segments: Segment[]): string | null {
  let total = 0
  for (const seg of segments) {
    if (seg.duration) total += parseDurMin(seg.duration)
    if (seg.connectionAfter) {
      // format: "Conexión en Ciudad · 1h 20m"
      const after = seg.connectionAfter.split('·').pop()?.trim() || ''
      const conn = parseDurMin(after)
      if (conn > 0) total += conn
    }
  }
  return total > 0 ? fmtMin(total) : null
}

function money(n: number, currency: string) {
  const sym = currency === 'EUR' ? '€' : '$'
  return sym + (Number(n) || 0).toLocaleString('en-US')
}

function money2(n: number, currency: string) {
  const sym = currency === 'EUR' ? '€' : '$'
  return sym + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeItem(it: Record<string, unknown>): QuoteItem | null {
  if (!it || !it.type) return null
  if (it.type === 'flight') {
    return {
      type: 'flight', dir: (it.dir as string) || 'Ida', date: (it.date as string) || '',
      price: Number(it.price) || 0, baggage: (it.baggage as string) || '',
      segments: ((it.segments as unknown[]) || []).map((sg) => Object.assign(newSeg(), sg as object)),
    }
  }
  if (it.type === 'hotel') return { type: 'hotel', name: (it.name as string) || 'Hotel', location: (it.location as string) || '', checkIn: (it.checkIn as string) || '', checkOut: (it.checkOut as string) || '', nights: (it.nights as string) || '', roomType: (it.roomType as string) || '', board: (it.board as string) || '', price: Number(it.price) || 0 }
  if (it.type === 'cruise') return { type: 'cruise', line: (it.line as string) || '', ship: (it.ship as string) || '', route: (it.route as string) || '', depart: (it.depart as string) || '', nights: (it.nights as string) || '', cabin: (it.cabin as string) || '', cabinLabel: (it.cabinLabel as string) || '', boardingTime: (it.boardingTime as string) || '', ports: ((it.ports as unknown[]) || []).map((p) => ({ date: (p as Record<string,string>).date || '', port: (p as Record<string,string>).port || '', arr: (p as Record<string,string>).arr || '', dep: (p as Record<string,string>).dep || '' })), promotion: (it.promotion as string) || '', price: Number(it.price) || 0 }
  if (it.type === 'tour') return { type: 'tour', name: (it.name as string) || 'Tour', location: (it.location as string) || '', date: (it.date as string) || '', duration: (it.duration as string) || '', includes: (it.includes as string) || '', price: Number(it.price) || 0 }
  if (it.type === 'transfer') return { type: 'transfer', from: (it.from as string) || '', to: (it.to as string) || '', date: (it.date as string) || '', vehicle: (it.vehicle as string) || '', mode: (it.mode as string) || 'Privado', price: Number(it.price) || 0 }
  if (it.type === 'car') return { type: 'car', category: (it.category as string) || '', model: (it.model as string) || '', pickupLocation: (it.pickupLocation as string) || '', dropoffLocation: (it.dropoffLocation as string) || '', pickupDate: (it.pickupDate as string) || '', returnDate: (it.returnDate as string) || '', days: (it.days as string) || '', passengers: (it.passengers as string) || '5', bags: (it.bags as string) || '2', doors: (it.doors as string) || '4', ac: (it.ac as string) || 'Sí', transmission: (it.transmission as string) || 'Automático', protection: (it.protection as string) || '', promotion: (it.promotion as string) || '', price: Number(it.price) || 0 }
  if (it.type === 'insurance') return { type: 'insurance', company: (it.company as string) || '', plan: (it.plan as string) || '', destination: (it.destination as string) || '', startDate: (it.startDate as string) || '', endDate: (it.endDate as string) || '', days: (it.days as string) || '', coverage: (it.coverage as string) || '', price: Number(it.price) || 0 }
  return null
}

function buildSummary(q: QuoteDoc) {
  const s = SELLERS[q.sellerIndex] || SELLERS[0]
  const L: string[] = []
  L.push('COTIZACIÓN CE VIAJA — ' + q.number)
  L.push(q.client)
  ;(q.pax || []).forEach((p, i) => L.push('  Pax ' + (i + 1) + ': ' + (p.name || '').toUpperCase() + ' (' + p.type + ' · ' + (p.cabin || 'Económica') + ')'))
  L.push('')
  q.items.forEach(it => {
    if (it.type === 'flight') {
      const fi = it as FlightItem
      L.push((fi.dir || '').toUpperCase() + ' — ' + fi.date)
      fi.segments.forEach(sg => {
        L.push('  ' + sg.airline + ' ' + sg.flightNo + ': ' + sg.from + ' ' + sg.dep + ' → ' + sg.to + ' ' + sg.arr + (sg.plus ? ' ' + sg.plus : '') + '  (' + sg.duration + ', ' + sg.cabin + ')')
        if (sg.connectionAfter) L.push('  ' + sg.connectionAfter)
      })
      if (fi.baggage) L.push('  Equipaje: ' + fi.baggage)
    } else if (it.type === 'hotel') {
      const hi = it as HotelItem
      L.push('HOTEL ' + hi.name + ' — ' + hi.location + '  (' + hi.checkIn + ' a ' + hi.checkOut + ', ' + hi.nights + ' noches, ' + hi.roomType + ')')
    } else if (it.type === 'cruise') {
      const ci = it as CruiseItem
      L.push('CRUCERO ' + ci.line + ' ' + ci.ship + ' — ' + ci.route + '  (' + ci.depart + ', ' + ci.nights + ' noches)')
      if (ci.boardingTime) L.push('  Embarque: ' + ci.boardingTime)
      if (ci.ports && ci.ports.length > 0) {
        ci.ports.forEach((p: CruisePort) => L.push('  ' + p.date + '  ' + p.port + (p.arr ? '  LLegada: ' + p.arr : '') + (p.dep ? '  Salida: ' + p.dep : '')))
      }
      if (ci.promotion) L.push('  Promoción: ' + ci.promotion)
    } else if (it.type === 'tour') {
      const ti = it as TourItem
      L.push('TOUR ' + ti.name + ' — ' + ti.location + '  (' + ti.date + ', ' + ti.duration + ')')
    } else if (it.type === 'transfer') {
      const tr = it as TransferItem
      L.push('TRASLADO ' + tr.mode + ': ' + tr.from + ' → ' + tr.to + '  (' + tr.date + ', ' + tr.vehicle + ')')
    } else if (it.type === 'car') {
      const ca = it as CarItem
      L.push('CARRO ' + ca.category + ' — ' + ca.model + '  (' + ca.pickupDate + ' a ' + ca.returnDate + ', ' + ca.days + ' días, ' + ca.transmission + ')')
    }
    L.push('  Precio: ' + money(it.price, q.currency) + ' ' + q.currency)
    L.push('')
  })
  const sub = q.items.reduce((a, it) => a + (Number(it.price) || 0), 0)
  L.push('Subtotal: ' + money(sub, q.currency) + ' ' + q.currency)
  L.push('TOTAL: ' + money(sub + (Number(q.taxes) || 0), q.currency) + ' ' + q.currency)
  L.push('')
  L.push('Tu asesor: ' + s.name + ' · ' + s.phone + ' · ' + s.email)
  return L.join('\n')
}

// ─── Image slot component ─────────────────────────────────────────────────────

function ImageSlot({ id, placeholder, photos, onChange }: {
  id: string; placeholder: string; photos: Record<string, string>;
  onChange: (id: string, src: string) => void
}) {
  const src = photos[id]
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => ref.current?.click()}
      style={{
        width: '100%', height: '100%', borderRadius: 10, border: '1.5px dashed #CFD9E3',
        background: src ? 'transparent' : '#F7FBFD', overflow: 'hidden', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}
    >
      {src
        ? <img src={src} alt={placeholder} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: 11, color: '#9AA8B8', textAlign: 'center', padding: '0 8px' }}>{placeholder}</span>
      }
      <input
        ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = ev => onChange(id, ev.target?.result as string)
          reader.readAsDataURL(file)
        }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CotizadorApp() {
  const supabase = createClient()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // Core state
  const [quote, setQuote] = useState<QuoteDoc>(seed)
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([])
  const [clients, setClients] = useState<CRMClient[]>([])
  const [hotelPhotos, setHotelPhotos] = useState<Record<string, string>>({})
  const [carPhotos, setCarPhotos] = useState<Record<string, string>>({})
  const [cruisePhotos, setCruisePhotos] = useState<Record<string, string>>({})
  // keys: `${idx}-ext` (ship exterior) and `${idx}-cabin` (cabin interior)
  const [shipAutoPhoto, setShipAutoPhoto] = useState<Record<string, string>>({})

  // AI edit state
  const [aiCmd, setAiCmd] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const [aiFiles, setAiFiles] = useState<File[]>([])

  // UI state
  const [showImport, setShowImport] = useState(false)
  const [showDB, setShowDB] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [toast, setToast] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfName, setPdfName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ msg: string; onConfirm: () => void } | null>(null)

  // Import state
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importError, setImportError] = useState('')
  const [importFiles, setImportFiles] = useState<File[]>([])
  const importFile = useRef<File | null>(null)

  // Filter state
  const [filterText, setFilterText] = useState('')
  const [filterSeller, setFilterSeller] = useState(-1)
  const [filterStatus, setFilterStatus] = useState('all')

  // Client form state
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm)
  const [clientSearch, setClientSearch] = useState('')
  const [clientError, setClientError] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [clientFormDropdownOpen, setClientFormDropdownOpen] = useState(false)
  const [confirmDropdownOpen, setConfirmDropdownOpen] = useState(false)
  const [quickNewClientOpen, setQuickNewClientOpen] = useState(false)
  const [quickNewClientPhone, setQuickNewClientPhone] = useState('')
  const [quickNewClientEmail, setQuickNewClientEmail] = useState('')
  const [confirmClient, setConfirmClient] = useState<{
    name: string; phone: string; email: string; passport: string; exists: boolean; existingId?: string
  } | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSavedQuotes()
    loadClients()
    initQuoteNumber()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function initQuoteNumber() {
    try {
      const res = await fetch('/api/cotizador/quote-number', { method: 'POST' })
      const data = await res.json()
      setQuote(q => ({ ...q, number: fmtNum(data.value) }))
    } catch {
      // keep seed number
    }
  }

  async function loadSavedQuotes() {
    try {
      const res = await fetch('/api/cotizador/quotes')
      if (!res.ok) { const e = await res.json(); showToast('⚠️ ' + e.error); return }
      const data: Record<string, unknown>[] = await res.json()
      setSavedQuotes(data.map(r => ({
        id: r.id as string,
        number: r.number as string,
        client: r.client as string,
        sellerIndex: r.seller_index as number,
        savedAt: r.saved_at as string,
        status: r.status as 'Pendiente' | 'Enviada' | 'Aceptada',
        total: r.total as number,
        products: r.products as string,
        quote: r.data as QuoteDoc,
      })))
    } catch {
      // offline
    }
  }

  async function loadClients() {
    try {
      const res = await fetch('/api/cotizador/clients')
      if (!res.ok) return
      const data: Record<string, unknown>[] = await res.json()
      setClients(data.map(r => ({
        id: r.id as string,
        name: r.name as string,
        phone: (r.phone as string) || '',
        email: (r.email as string) || '',
        passport: (r.passport as string) || '',
        photo: (r.photo_url as string) || '',
        notes: (r.notes as string) || '',
        createdAt: r.created_at as string,
      })))
    } catch {
      // offline
    }
  }

  // ── Quote operations ─────────────────────────────────────────────────────────

  async function nuevaCotizacion() {
    try {
      const res = await fetch('/api/cotizador/quote-number', { method: 'POST' })
      const data = await res.json()
      const fresh = seed()
      fresh.number = fmtNum(data.value)
      fresh.sellerIndex = quote.sellerIndex
      setQuote(fresh)
      setHotelPhotos({}); setCarPhotos({})
    } catch {
      const fresh = seed()
      fresh.sellerIndex = quote.sellerIndex
      setQuote(fresh)
      setHotelPhotos({}); setCarPhotos({})
    }
  }

  async function saveCurrent(): Promise<string> {
    const q = quote
    const rec: SavedQuote = {
      id: crypto.randomUUID(),
      number: q.number,
      client: q.client,
      sellerIndex: q.sellerIndex,
      savedAt: new Date().toISOString(),
      status: 'Pendiente',
      total: totalOf(q),
      products: productSummary(q),
      quote: JSON.parse(JSON.stringify(q)),
    }

    try {
      const existing = savedQuotes.find(r => r.number === q.number)
      const action = existing ? 'upsert' : 'insert'
      if (existing) { rec.id = existing.id; rec.status = existing.status }
      const res = await fetch('/api/cotizador/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: rec.id, number: rec.number, client: rec.client, seller_index: rec.sellerIndex, saved_at: rec.savedAt, status: rec.status, total: rec.total, products: rec.products, data: rec.quote }),
      })
      if (!res.ok) { const e = await res.json(); showToast('⚠️ ' + e.error); return rec.id }
    } catch (err) {
      console.error('Error guardando cotización:', err)
      showToast('⚠️ Error de red al guardar')
    }

    setSavedQuotes(prev => {
      const list = prev.slice()
      const i = list.findIndex(r => r.number === q.number)
      if (i >= 0) { list[i] = rec } else { list.unshift(rec) }
      return list
    })
    showToast('Cotización guardada')
    return rec.id
  }

  async function openSaved(id: string) {
    const r = savedQuotes.find(x => x.id === id)
    if (r) {
      setQuote(JSON.parse(JSON.stringify(r.quote)))
      setHotelPhotos({}); setCarPhotos({})
      setShowDB(false)
    }
  }

  async function downloadSavedPDF(id: string) {
    const r = savedQuotes.find(x => x.id === id)
    if (!r) return
    setQuote(JSON.parse(JSON.stringify(r.quote)))
    setHotelPhotos({}); setCarPhotos({})
    setShowDB(false)
    // Wait one frame for the doc to render, then generate PDF
    await new Promise(res => setTimeout(res, 600))
    await downloadPDF()
  }

  async function duplicateSaved(id: string) {
    const r = savedQuotes.find(x => x.id === id)
    if (!r) return
    try {
      const res = await fetch('/api/cotizador/quote-number', { method: 'POST' })
      const data = await res.json()
      const q: QuoteDoc = JSON.parse(JSON.stringify(r.quote))
      q.number = fmtNum(data.value)
      setQuote(q)
      setHotelPhotos({}); setCarPhotos({})
      setShowDB(false)
      showToast('Cotización duplicada')
    } catch {
      showToast('Error al duplicar')
    }
  }

  async function deleteSaved(id: string) {
    fetch('/api/cotizador/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    setSavedQuotes(prev => prev.filter(x => x.id !== id))
  }

  async function setSavedStatus(id: string, status: string) {
    fetch('/api/cotizador/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status', id, status }) })
    setSavedQuotes(prev => prev.map(x => x.id === id ? { ...x, status: status as SavedQuote['status'] } : x))
  }

  // ── Client operations ────────────────────────────────────────────────────────

  async function saveClient() {
    const cf = clientForm
    if (!cf.name?.trim()) {
      setClientError('Escribe el nombre del cliente.')
      return
    }
    if (cf.id) {
      await fetch('/api/cotizador/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: cf.id, name: cf.name, phone: cf.phone, email: cf.email, passport: cf.passport, notes: cf.notes, ...(cf.photo ? { photo_url: cf.photo } : {}) }) })
      setClients(prev => prev.map(c => c.id === cf.id ? { ...c, ...cf, photo: cf.photo || c.photo } : c))
    } else {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      await fetch('/api/cotizador/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', id, name: cf.name, phone: cf.phone, email: cf.email, passport: cf.passport, notes: cf.notes, photo_url: cf.photo || '', created_at: now }) })
      setClients(prev => [{ id, name: cf.name, phone: cf.phone, email: cf.email, passport: cf.passport, photo: cf.photo, notes: cf.notes, createdAt: now }, ...prev])
    }
    setClientForm(emptyClientForm())
    setClientError('')
    showToast(cf.id ? 'Cliente actualizado' : 'Cliente guardado')
  }

  async function quickCreateClient() {
    const name = (quote.client || '').trim()
    if (!name) { showToast('Escribe el nombre del cliente primero'); return }
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    fetch('/api/cotizador/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', id, name, phone: quickNewClientPhone, email: quickNewClientEmail, passport: '', notes: '', photo_url: '', created_at: now }) })
    const newC: CRMClient = { id, name, phone: quickNewClientPhone, email: quickNewClientEmail, passport: '', photo: '', notes: '', createdAt: now }
    setClients(prev => [newC, ...prev])
    setQuote(q => ({ ...q, clientPhone: quickNewClientPhone, clientEmail: quickNewClientEmail, clientId: id }))
    setQuickNewClientOpen(false); setQuickNewClientPhone(''); setQuickNewClientEmail('')
    showToast('Cliente creado')
  }

  async function deleteClient(id: string) {
    fetch('/api/cotizador/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
    setClients(prev => prev.filter(c => c.id !== id))
  }

  function useClient(id: string) {
    const c = clients.find(x => x.id === id)
    if (!c) return
    setQuote(q => ({
      ...q, client: c.name || '', clientPhone: c.phone || '',
      clientEmail: c.email || '', clientPassport: c.passport || '', clientId: c.id,
    }))
    setShowClients(false)
    showToast('Cliente cargado en la cotización')
  }

  function selectClient(c: CRMClient) {
    setQuote(q => ({
      ...q, client: c.name || '', clientPhone: c.phone || '',
      clientEmail: c.email || '', clientPassport: c.passport || '', clientId: c.id,
    }))
    showToast('Cliente cargado')
  }

  async function acceptConfirmClient() {
    if (!confirmClient) { setConfirmClient(null); return }
    const c = confirmClient
    const nm = (c.name || '').toLowerCase().trim()
    const ps = (c.passport || '').toLowerCase().trim()
    const existing = clients.find(x =>
      (ps && (x.passport || '').toLowerCase().trim() === ps) ||
      (nm && (x.name || '').toLowerCase().trim() === nm)
    )
    if (existing) {
      const merged = { ...existing, name: c.name || existing.name, phone: c.phone || existing.phone, email: c.email || existing.email, passport: c.passport || existing.passport }
      fetch('/api/cotizador/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: existing.id, name: merged.name, phone: merged.phone, email: merged.email, passport: merged.passport }) })
      setClients(prev => prev.map(x => x.id === existing.id ? merged : x))
      setQuote(q => ({ ...q, clientId: existing.id }))
      showToast('Cliente actualizado')
    } else {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const rec: CRMClient = { id, name: c.name || '', phone: c.phone || '', email: c.email || '', passport: c.passport || '', photo: '', notes: '', createdAt: now }
      fetch('/api/cotizador/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'insert', id, name: rec.name, phone: rec.phone, email: rec.email, passport: rec.passport, notes: '', photo_url: '', created_at: now }) })
      setClients(prev => [rec, ...prev])
      setQuote(q => ({ ...q, clientId: id }))
      showToast('Cliente guardado')
    }
    setConfirmClient(null)
  }

  // ── AI Import ────────────────────────────────────────────────────────────────

  async function processImport() {
    try {
      setImportBusy(true)
      setImportError('')
      setImportMsg('Preparando…')

      const fd = new FormData()
      if (importFiles.length > 0) {
        setImportMsg(`Leyendo ${importFiles.length > 1 ? importFiles.length + ' archivos' : importFiles[0].name} con IA…`)
        importFiles.forEach(f => fd.append('files', f))
      } else if (importText.trim()) {
        fd.append('text', importText)
      } else {
        setImportBusy(false)
        setImportError('Sube al menos un archivo o pega el texto del itinerario.')
        setImportMsg('')
        return
      }

      setImportMsg('La IA está leyendo y rellenando…')
      const res = await fetch('/api/cotizador/import', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setImportBusy(false)
        setImportError(data.error || 'Error al procesar.')
        setImportMsg('')
        return
      }

      const newItems = (Array.isArray(data.items) ? data.items : [])
        .map((it: Record<string, unknown>) => normalizeItem(it))
        .filter(Boolean) as QuoteItem[]

      setQuote(q => {
        const updated = JSON.parse(JSON.stringify(q)) as QuoteDoc
        if (data.client) updated.client = data.client
        if (data.clientPhone) updated.clientPhone = data.clientPhone
        if (data.clientEmail) updated.clientEmail = data.clientEmail
        if (data.clientPassport) updated.clientPassport = data.clientPassport
        if (Array.isArray(data.pax) && data.pax.length) {
          updated.pax = data.pax.map((p: Record<string, string>) => ({
            name: p.name || '', type: p.type || 'Adulto', cabin: p.cabin || 'Económica',
          }))
        }
        if (Number(data.taxes)) updated.taxes = Number(data.taxes)
        if (Number(data.priceAdulto)) updated.priceAdulto = Number(data.priceAdulto)
        if (Number(data.priceNino)) updated.priceNino = Number(data.priceNino)
        if (Number(data.priceJubilado)) updated.priceJubilado = Number(data.priceJubilado)
        if (newItems.length) updated.items = newItems
        updated.items.forEach((item, idx) => {
          if (item.type === 'flight') applyFlightCalcs(item as FlightItem)
          if (item.type === 'cruise') {
            const ci = item as CruiseItem
            if (ci.ship) fetchShipPhotos(ci.ship, idx)
            const firstPort = ci.ports?.find(p => p.port?.trim())
            if (firstPort) fetchPortPhoto(firstPort.port, idx)
          }
          if (item.type === 'car') {
            const ca = item as CarItem
            if (ca.model) fetchCarPhoto(ca.model, idx)
          }
        })
        return updated
      })

      setImportBusy(false)
      setShowImport(false)
      setImportText('')
      setImportMsg('')
      setImportFiles([])
      importFile.current = null
      showToast('Datos rellenados por la IA — revísalos')

      const cName = data.client || '', cPhone = data.clientPhone || ''
      const cEmail = data.clientEmail || '', cPass = data.clientPassport || ''
      if (cName || cPhone || cEmail || cPass) {
        const nm = cName.toLowerCase().trim(), ps = cPass.toLowerCase().trim()
        const existing = clients.find(x =>
          (ps && (x.passport || '').toLowerCase().trim() === ps) ||
          (nm && (x.name || '').toLowerCase().trim() === nm)
        )
        // Merge: existing CRM data as base, AI data overrides where non-empty
        const merged = {
          name: cName || existing?.name || '',
          phone: cPhone || existing?.phone || '',
          email: cEmail || existing?.email || '',
          passport: cPass || existing?.passport || '',
        }
        setTimeout(() => setConfirmClient({ ...merged, exists: !!existing, existingId: existing?.id }), 350)
      }
    } catch (err) {
      setImportBusy(false)
      setImportMsg('')
      setImportError((err instanceof Error ? err.message : '') || 'No se pudo procesar. Intenta con el texto.')
    }
  }

  // ── Field handler ─────────────────────────────────────────────────────────────

  function applyFlightCalcs(fi: FlightItem): void {
    const segs = fi.segments
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]
      // Auto-duration: timezone-aware first, arithmetic fallback if airports not in DB
      if (seg.dep && seg.arr) {
        const dur = calcFlightDuration(seg.from, seg.dep, seg.to, seg.arr, fi.date, seg.plus)
        if (dur) {
          seg.duration = dur
        } else {
          // Arithmetic fallback — runs always so AI-imported durations without TZ correction get replaced
          const [dh, dm] = seg.dep.split(':').map(Number)
          const [ah, am] = seg.arr.split(':').map(Number)
          const plusD = parseInt((seg.plus || '').replace(/\D/g, '') || '0')
          let diff = (ah * 60 + am) - (dh * 60 + dm) + plusD * 1440
          if (diff < 0) diff += 1440
          if (diff >= 20 && diff <= 1440) seg.duration = fmtMin(diff)
        }
      }
      // Auto-layover between this segment and next
      if (i < segs.length - 1) {
        const nxt = segs[i + 1]
        if (seg.arr && nxt.dep && /^\d{1,2}:\d{2}$/.test(seg.arr) && /^\d{1,2}:\d{2}$/.test(nxt.dep)) {
          const [ah, am] = seg.arr.split(':').map(Number)
          const [dh, dm] = nxt.dep.split(':').map(Number)
          let diff = dh * 60 + dm - (ah * 60 + am)
          if (diff <= 0) diff += 1440
          if (diff >= 20 && diff <= 1440) {
            const h = Math.floor(diff / 60), m = diff % 60
            const durStr = h + 'h' + (m ? ' ' + m + 'm' : '')
            const city = seg.toCity || seg.to || ''
            seg.connectionAfter = city ? `Conexión en ${city} · ${durStr}` : `Conexión · ${durStr}`
          }
        }
      } else {
        seg.connectionAfter = ''
      }
    }
  }

  async function fetchCarPhoto(model: string, idx: number) {
    if (!model.trim()) return
    try {
      // Search Wikipedia for the car model
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(model)}&srlimit=3&format=json&origin=*`
      )
      if (!searchRes.ok) return
      const searchData = await searchRes.json()
      const results: { title: string }[] = searchData.query?.search || []
      for (const result of results) {
        const pageRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(result.title)}&prop=pageimages&format=json&pithumbsize=1200&origin=*`
        )
        if (!pageRes.ok) continue
        const pageData = await pageRes.json()
        const pages = pageData.query?.pages
        if (!pages) continue
        const page = Object.values(pages)[0] as { thumbnail?: { source: string } }
        if (page?.thumbnail?.source) {
          setCarPhotos(p => ({ ...p, [`car${idx}-photo`]: page.thumbnail!.source }))
          return
        }
      }
    } catch { /* ignore */ }
  }

  async function sendAiEdit() {
    if ((!aiCmd.trim() && aiFiles.length === 0) || aiBusy) return
    setAiBusy(true)
    setAiMsg('')
    try {
      const fd = new FormData()
      fd.append('quote', JSON.stringify(quote))
      fd.append('instruction', aiCmd)
      aiFiles.forEach(f => fd.append('files', f))
      const res = await fetch('/api/cotizador/ai-edit', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { setAiMsg('Error: ' + data.error); return }
      if (data.quote) {
        setQuote(data.quote)
        data.quote.items?.forEach((item: QuoteItem, idx: number) => {
          if (item.type === 'cruise') { const ci = item as CruiseItem; if (ci.ship) fetchShipPhotos(ci.ship, idx) }
          if (item.type === 'car') { const ca = item as CarItem; if (ca.model) fetchCarPhoto(ca.model, idx) }
        })
        setAiMsg(data.message || 'Listo.')
        setAiCmd('')
        setAiFiles([])
      }
    } catch { setAiMsg('Error de conexión.') }
    finally { setAiBusy(false) }
  }

  async function fetchShipPhotos(shipName: string, idx: number) {
    if (!shipName.trim()) return
    try {
      // 1st try: exact Wikipedia article title
      const slug = shipName.trim().replace(/\s+/g, '_')
      const extRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(slug)}&prop=pageimages&format=json&pithumbsize=2000&origin=*`
      )
      if (extRes.ok) {
        const extData = await extRes.json()
        const pages = extData.query?.pages
        if (pages) {
          const page = Object.values(pages)[0] as { thumbnail?: { source: string }; missing?: string }
          if (page?.thumbnail?.source) {
            setShipAutoPhoto(p => ({ ...p, [`${idx}-ext`]: page.thumbnail!.source }))
            return
          }
        }
      }

      // 2nd try: Wikipedia search (same approach as car photos)
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(shipName + ' cruise ship')}&srlimit=3&format=json&origin=*`
      )
      if (!searchRes.ok) return
      const searchData = await searchRes.json()
      const results: { title: string }[] = searchData.query?.search || []
      for (const result of results) {
        const pageRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(result.title)}&prop=pageimages&format=json&pithumbsize=2000&origin=*`
        )
        if (!pageRes.ok) continue
        const pageData = await pageRes.json()
        const pages = pageData.query?.pages
        if (!pages) continue
        const page = Object.values(pages)[0] as { thumbnail?: { source: string } }
        if (page?.thumbnail?.source) {
          setShipAutoPhoto(p => ({ ...p, [`${idx}-ext`]: page.thumbnail!.source }))
          return
        }
      }
    } catch { /* ignore */ }
  }

  async function fetchPortPhoto(portName: string, idx: number) {
    if (!portName.trim()) return
    try {
      // Extract city name — port strings are like "NASSAU, BAHAMAS" or "COZUMEL, MEXICO"
      const city = portName.split(',')[0].trim()
      const slug = city.replace(/\s+/g, '_')
      const res = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(slug)}&prop=pageimages&format=json&pithumbsize=2000&origin=*`
      )
      if (!res.ok) return
      const data = await res.json()
      const pages = data.query?.pages
      if (!pages) return
      const page = Object.values(pages)[0] as { thumbnail?: { source: string } }
      if (page?.thumbnail?.source) {
        setShipAutoPhoto(p => ({ ...p, [`${idx}-cabin`]: page.thumbnail!.source }))
      }
    } catch { /* ignore */ }
  }

  function onField(path: string, value: string | number) {
    setQuote(q => {
      const next = setPath(q, path, value)
      const segMatch = path.match(/^items\.(\d+)\.segments\.(\d+)\.(dep|arr|plus|from|to|toCity)$/)
      if (segMatch) {
        const ii = parseInt(segMatch[1])
        const fi = next.items[ii] as FlightItem
        applyFlightCalcs(fi)
      }
      return next
    })
    // Auto-fetch ship photo from Wikipedia when ship name changes
    const shipMatch = path.match(/^items\.(\d+)\.ship$/)
    if (shipMatch && typeof value === 'string') {
      fetchShipPhotos(value, parseInt(shipMatch[1]))
    }
    // Auto-fetch car photo when model changes
    const carMatch = path.match(/^items\.(\d+)\.model$/)
    if (carMatch && typeof value === 'string') {
      const idx = parseInt(carMatch[1])
      setQuote(q => {
        if ((q.items[idx] as CarItem)?.type === 'car') { fetchCarPhoto(value, idx) }
        return q
      })
    }
    // Auto-fetch port photo when first port name changes
    const portMatch = path.match(/^items\.(\d+)\.ports\.0\.port$/)
    if (portMatch && typeof value === 'string' && value.trim()) {
      fetchPortPhoto(value, parseInt(portMatch[1]))
    }
  }

  function onAction(act: string, idx: number, seg?: number, itemType?: string) {
    setQuote(q => {
      const clone: QuoteDoc = JSON.parse(JSON.stringify(q))
      if (act === 'add' && itemType) clone.items.push(newItem(itemType))
      else if (act === 'remove') clone.items.splice(idx, 1)
      else if (act === 'up' && idx > 0) { [clone.items[idx - 1], clone.items[idx]] = [clone.items[idx], clone.items[idx - 1]] }
      else if (act === 'down' && idx < clone.items.length - 1) { [clone.items[idx + 1], clone.items[idx]] = [clone.items[idx], clone.items[idx + 1]] }
      else if (act === 'addSeg') { ;(clone.items[idx] as FlightItem).segments.push(newSeg()); applyFlightCalcs(clone.items[idx] as FlightItem) }
      else if (act === 'removeSeg' && seg !== undefined) { ;(clone.items[idx] as FlightItem).segments.splice(seg, 1); applyFlightCalcs(clone.items[idx] as FlightItem) }
      else if (act === 'addPort') { ;(clone.items[idx] as CruiseItem).ports = [...((clone.items[idx] as CruiseItem).ports || []), { date: '', port: '', arr: '', dep: '' }] }
      else if (act === 'removePort' && seg !== undefined) { ;(clone.items[idx] as CruiseItem).ports.splice(seg, 1) }
      else if (act === 'addPax') clone.pax.push({ name: '', type: 'Adulto', cabin: 'Económica' })
      else if (act === 'removePax') clone.pax.splice(idx, 1)
      return clone
    })
  }

  function onClientName(v: string) {
    const c = clients.find(x => (x.name || '').toLowerCase() === v.toLowerCase().trim())
    setQuote(q => ({
      ...q, client: v,
      ...(c ? { clientPhone: c.phone || '', clientEmail: c.email || '', clientPassport: c.passport || '', clientId: c.id } : {}),
    }))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const seller = SELLERS[quote.sellerIndex] || SELLERS[0]
  const adultoCount   = (quote.pax || []).filter(p => p.type === 'Adulto').length
  const ninoCount     = (quote.pax || []).filter(p => p.type === 'Niño').length
  const jubCount      = (quote.pax || []).filter(p => p.type === 'Jubilado').length
  const infanteCount  = (quote.pax || []).filter(p => p.type === 'Infante').length
  const total = adultoCount  * (quote.priceAdulto   || 0)
              + ninoCount    * (quote.priceNino      || 0)
              + jubCount     * (quote.priceJubilado  || 0)
              + infanteCount * (quote.priceInfante   || 0)
  const paxCount = (quote.pax || []).length
  const perPax = paxCount > 0 ? total / paxCount : total
  const totalFmt = money(total, quote.currency)
  const perPaxFmt = money2(perPax, quote.currency)

  const paxSummary = (() => {
    const c: Record<string, number> = {}
    ;(quote.pax || []).forEach(p => { c[p.type] = (c[p.type] || 0) + 1 })
    const parts: string[] = []
    if (c['Adulto']) parts.push(c['Adulto'] + (c['Adulto'] === 1 ? ' adulto' : ' adultos'))
    if (c['Niño']) parts.push(c['Niño'] + (c['Niño'] === 1 ? ' niño' : ' niños'))
    if (c['Infante']) parts.push(c['Infante'] + (c['Infante'] === 1 ? ' infante' : ' infantes'))
    return parts.join(' · ') || 'Sin pasajeros'
  })()

  const cabinSummary = (() => {
    const cabs = [...new Set((quote.pax || []).map(p => p.cabin || 'Económica'))]
    return cabs.length === 0 ? 'Económica' : cabs.length === 1 ? cabs[0] : 'Varias clases'
  })()

  const clientesFrec = [...new Set([
    ...clients.map(c => c.name),
    ...savedQuotes.map(r => r.client),
  ].filter(Boolean))]

  const savedView = savedQuotes
    .filter(r => {
      const ft = filterText.toLowerCase()
      if (ft && !((r.number || '') + ' ' + (r.client || '')).toLowerCase().includes(ft)) return false
      if (filterSeller >= 0 && r.sellerIndex !== filterSeller) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      return true
    })
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))

  const clientsView = clients.filter(c => {
    const s = clientSearch.toLowerCase()
    if (!s) return true
    return ((c.name || '') + ' ' + (c.phone || '') + ' ' + (c.email || '') + ' ' + (c.passport || '')).toLowerCase().includes(s)
  })

  const stcColor: Record<string, string> = { Pendiente: '#B08400', Enviada: '#1763B0', Aceptada: '#1F8A5B' }
  const ITEM_LABELS: Record<string, string> = { flight: 'Vuelo', hotel: 'Hotel', cruise: 'Crucero', tour: 'Tour', transfer: 'Traslado', car: 'Carro', insurance: 'Seguro' }
  const PAX_CODE: Record<string, string> = { Adulto: 'ADT', Niño: 'CHD', Jubilado: 'JUB', Infante: 'INF' }

  // ─── Styles ───────────────────────────────────────────────────────────────────

  const inputSt: React.CSSProperties = {
    width: '100%', border: '1px solid #D8E0E8', borderRadius: 8,
    padding: '7px 9px', fontSize: 13, color: '#15293F', background: '#fff',
    outline: 'none', fontFamily: 'Manrope, sans-serif',
  }
  const labelSt: React.CSSProperties = {
    fontSize: 10, color: '#8896A6', textTransform: 'uppercase',
    letterSpacing: '.07em', fontWeight: 700, display: 'block', marginBottom: 4,
  }
  const smInputSt: React.CSSProperties = { ...inputSt, padding: '6px 8px', fontSize: 12 }
  const smLabelSt: React.CSSProperties = { ...labelSt, fontSize: 9, letterSpacing: '.05em', marginBottom: 3 }

  // ─── PDF generation ──────────────────────────────────────────────────────────

  async function generatePDFBlob(): Promise<Blob> {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])
    const el = document.getElementById('doc')!
    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, allowTaint: true, logging: false,
      backgroundColor: '#ffffff',
    })

    // Letter size with 10mm margins
    const MARGIN = 10 // mm
    const pdf = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' })
    const pageW = pdf.internal.pageSize.getWidth()   // 215.9 mm
    const pageH = pdf.internal.pageSize.getHeight()  // 279.4 mm
    const printW = pageW - MARGIN * 2
    const printH = pageH - MARGIN * 2
    // px per mm when image is scaled to printW
    const pxPerMm = canvas.width / printW
    const pageHpx = Math.floor(printH * pxPerMm) // page usable height in canvas pixels

    const totalHmm = (canvas.height / canvas.width) * printW

    if (totalHmm <= printH) {
      // Fits on one page
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, printW, totalHmm)
      return pdf.output('blob')
    }

    // Multi-page: find clean break rows (near-white horizontal bands)
    const ctx = canvas.getContext('2d')!
    const pages: Array<{ start: number; end: number }> = []
    let startPx = 0

    while (startPx < canvas.height) {
      const idealEnd = Math.min(startPx + pageHpx, canvas.height)
      let breakPx = idealEnd

      if (idealEnd < canvas.height) {
        // Search backwards up to 15% of page height for a white-ish row
        const searchFrom = Math.max(startPx + Math.floor(pageHpx * 0.7), idealEnd - Math.floor(pageHpx * 0.15))
        outer: for (let y = idealEnd; y >= searchFrom; y--) {
          const row = ctx.getImageData(0, y, canvas.width, 1).data
          for (let x = 0; x < row.length; x += 4 * 8) { // sample every 8th px
            if (row[x] < 230 || row[x + 1] < 230 || row[x + 2] < 230) continue outer
          }
          breakPx = y
          break
        }
      }

      pages.push({ start: startPx, end: breakPx })
      startPx = breakPx
    }

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) pdf.addPage()
      const { start, end } = pages[i]
      const sliceH = end - start
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = sliceH
      tmp.getContext('2d')!.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      const sliceHmm = (sliceH / canvas.width) * printW
      pdf.addImage(tmp.toDataURL('image/jpeg', 0.95), 'JPEG', MARGIN, MARGIN, printW, sliceHmm)
    }

    return pdf.output('blob')
  }

  async function downloadPDF() {
    setPdfBusy(true)
    try {
      const blob = await generatePDFBlob()
      const name = (pdfName.trim() || `CE-Viaja-${quote.number}`).replace(/\.pdf$/i, '')
      triggerDownload(blob, `${name}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function shareViaWhatsApp() {
    setPdfBusy(true)
    try {
      const blob = await generatePDFBlob()
      const filename = `CE-Viaja-${quote.number}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })

      // Mobile: native share with file
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Cotización CE Viaja ${quote.number}` })
        return
      }

      // Desktop: download PDF + open WhatsApp chat
      triggerDownload(blob, filename)
      const num = (quote.clientPhone || '').replace(/[^0-9]/g, '')
      const waBase = num ? `https://wa.me/${num}?text=` : 'https://wa.me/?text='
      window.open(waBase + encodeURIComponent(`Hola! 😊 Te adjunto tu cotización CE Viaja N.º ${quote.number} 📋`), '_blank')
      showToast('PDF descargado — adjúntalo en el chat de WhatsApp')
    } finally {
      setPdfBusy(false)
    }
  }

  async function shareViaEmail() {
    setPdfBusy(true)
    try {
      const blob = await generatePDFBlob()
      const filename = `CE-Viaja-${quote.number}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })

      // Mobile: native share
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Cotización CE Viaja ${quote.number}` })
        return
      }

      // Desktop: download PDF + open mail client
      triggerDownload(blob, filename)
      const to = quote.clientEmail || ''
      window.location.href = 'mailto:' + encodeURIComponent(to)
        + '?subject=' + encodeURIComponent('Cotización CE Viaja ' + quote.number)
        + '&body=' + encodeURIComponent(`Hola,\n\nAdjunto tu cotización CE Viaja N.º ${quote.number}.\n\nSaludos,\nCE Viaja`)
      showToast('PDF descargado — adjúntalo en el correo')
    } finally {
      setPdfBusy(false)
    }
  }

  function askDelete(msg: string, onConfirm: () => void) {
    setConfirmDelete({ msg, onConfirm })
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F4F7FA', fontFamily: 'Manrope, sans-serif' }}>

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 'none', height: 62, background: '#fff', borderBottom: '1px solid #E6ECF2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CE Viaja" style={{ height: 34, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <div style={{ width: 1, height: 26, background: '#E6ECF2' }} />
          <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 13, fontWeight: 700, color: '#0F3D7A', letterSpacing: '.04em' }}>Cotizador</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setShowImport(true); setImportError(''); setImportMsg('') }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: '#16A99C', color: '#fff', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '10px 15px', borderRadius: 9, cursor: 'pointer' }}
          >✨ Rellenar con IA</button>
          <button onClick={saveCurrent} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 9, cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setShowDB(true)} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 9, cursor: 'pointer' }}>
            Cotizaciones&nbsp;<span style={{ color: '#16A99C' }}>{savedQuotes.length}</span>
          </button>
          <button onClick={() => { setShowClients(true); setClientForm(emptyClientForm()); setClientError(''); setClientSearch('') }} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 9, cursor: 'pointer' }}>
            Clientes&nbsp;<span style={{ color: '#16A99C' }}>{clients.length}</span>
          </button>
          <div style={{ width: 1, height: 26, background: '#E6ECF2' }} />
          <button
            onClick={shareViaWhatsApp}
            disabled={pdfBusy}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 9, cursor: pdfBusy ? 'not-allowed' : 'pointer', opacity: pdfBusy ? .6 : 1 }}
          >WhatsApp</button>
          <button
            onClick={shareViaEmail}
            disabled={pdfBusy}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '9px 14px', borderRadius: 9, cursor: pdfBusy ? 'not-allowed' : 'pointer', opacity: pdfBusy ? .6 : 1 }}
          >Correo</button>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #C8D5E2', borderRadius: 9, overflow: 'hidden' }}>
            <input
              value={pdfName}
              onChange={e => setPdfName(e.target.value)}
              placeholder={`CE-Viaja-${quote.number}`}
              style={{ border: 'none', outline: 'none', fontSize: 12, color: '#15293F', padding: '9px 10px', width: 170, fontFamily: 'Manrope', background: '#fff' }}
            />
            <span style={{ fontSize: 11, color: '#9AA8B8', paddingRight: 8, background: '#fff' }}>.pdf</span>
            <button
              onClick={downloadPDF}
              disabled={pdfBusy}
              style={{ border: 'none', background: '#0F3D7A', color: '#fff', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '10px 14px', cursor: pdfBusy ? 'not-allowed' : 'pointer', opacity: pdfBusy ? .6 : 1, whiteSpace: 'nowrap' }}
            >{pdfBusy ? '…' : 'Descargar PDF'}</button>
          </div>
          <div style={{ width: 1, height: 26, background: '#E6ECF2' }} />
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{ border: '1px solid #E6ECF2', background: '#fff', color: '#9AA8B8', fontFamily: 'Manrope', fontWeight: 600, fontSize: 13, padding: '9px 12px', borderRadius: 9, cursor: 'pointer' }}
          >Salir</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── EDITOR (left panel) ──────────────────────────────────────────── */}
        <div id="editor" style={{ width: 452, flexShrink: 0, overflowY: 'auto', padding: 20, borderRight: '1px solid #E6ECF2' }}>

          {/* Datos de la cotización */}
          <div style={{ background: '#fff', border: '1px solid #EAEFF4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0F3D7A' }}>Datos de la cotización</div>
              <button onClick={nuevaCotizacion} style={{ border: '1px solid #BFE6F2', background: '#EAF6FB', color: '#0F3D7A', fontWeight: 700, fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer' }}>+ Nueva cotización</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr .8fr', gap: 10 }}>
              <div><span style={labelSt}>N.º (automático)</span><div style={{ border: '1px solid #E6ECF2', borderRadius: 8, padding: '7px 9px', fontSize: 13, color: '#0F3D7A', background: '#F4F7FA', fontWeight: 700 }}>{quote.number}</div></div>
              <label style={{ display: 'block' }}><span style={labelSt}>Fecha</span><input value={quote.date} onChange={e => onField('date', e.target.value)} style={inputSt} /></label>
              <div><span style={labelSt}>Vigencia</span><input value={quote.validez} onChange={e => setQuote(q => ({ ...q, validez: e.target.value }))} placeholder="24 horas" style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: '7px 9px', fontSize: 13, color: '#15293F', outline: 'none', boxSizing: 'border-box' }} /></div>
            </div>
          </div>

          {/* Cliente */}
          <div style={{ background: '#fff', border: '1px solid #EAEFF4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0F3D7A', marginBottom: 12 }}>Cliente</div>
            <div style={{ marginBottom: 10, position: 'relative' }}>
              <span style={labelSt}>Nombre del cliente</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={quote.client}
                  onChange={e => { onClientName(e.target.value); setClientDropdownOpen(true) }}
                  onFocus={() => setClientDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setClientDropdownOpen(false), 160)}
                  placeholder="Escribe o elige un cliente guardado"
                  style={{ ...inputSt, flex: 1 }}
                />
                <button
                  onMouseDown={e => { e.preventDefault(); setClientDropdownOpen(o => !o) }}
                  style={{ border: '1px solid #D8E0E8', background: '#F4F7FA', borderRadius: 8, padding: '0 10px', fontSize: 11, color: '#5B7186', cursor: 'pointer', flexShrink: 0 }}
                  title="Ver clientes guardados"
                >▼</button>
              </div>
              {clientDropdownOpen && (() => {
                const q = (quote.client || '').toLowerCase().trim()
                const matches = clients.filter(c =>
                  !q ||
                  (c.name || '').toLowerCase().includes(q) ||
                  (c.phone || '').includes(q) ||
                  (c.email || '').toLowerCase().includes(q)
                ).slice(0, 8)
                if (!matches.length) return null
                return (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #D8E0E8', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 50, maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
                    {matches.map(c => (
                      <div
                        key={c.id}
                        onMouseDown={() => { selectClient(c); setClientDropdownOpen(false) }}
                        style={{ padding: '9px 13px', cursor: 'pointer', borderBottom: '1px solid #F0F4F8' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>{c.name}</div>
                        {(c.phone || c.email) && (
                          <div style={{ fontSize: 11, color: '#8896A6', marginTop: 1 }}>
                            {[c.phone, c.email].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
            {/* Quick-create new client */}
            <div style={{ marginBottom: 10 }}>
              <button
                onMouseDown={e => { e.preventDefault(); setQuickNewClientOpen(o => !o) }}
                style={{ border: '1px dashed #BFD3E6', background: quickNewClientOpen ? '#F0F7FF' : '#fff', color: '#0F3D7A', fontWeight: 700, fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left' }}
              >
                {quickNewClientOpen ? '▲ Crear cliente' : '+ Crear cliente nuevo'}
              </button>
              {quickNewClientOpen && (
                <div style={{ border: '1px solid #D0E6FF', borderRadius: 10, padding: '12px 12px 10px', marginTop: 6, background: '#F7FBFF' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0F3D7A', marginBottom: 8 }}>
                    Nombre: <span style={{ color: '#15293F', fontWeight: 400 }}>{quote.client || <em style={{ color: '#C0CCDA' }}>sin nombre</em>}</span>
                  </div>
                  <label style={{ display: 'block', marginBottom: 7 }}>
                    <span style={labelSt}>Teléfono</span>
                    <input
                      value={quickNewClientPhone}
                      onChange={e => setQuickNewClientPhone(e.target.value)}
                      placeholder="+507 6000-0000"
                      style={inputSt}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    <span style={labelSt}>Email</span>
                    <input
                      value={quickNewClientEmail}
                      onChange={e => setQuickNewClientEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      style={inputSt}
                    />
                  </label>
                  <button
                    onClick={quickCreateClient}
                    style={{ border: 'none', background: '#0F3D7A', color: '#fff', fontWeight: 700, fontSize: 13, padding: '8px 0', borderRadius: 9, cursor: 'pointer', width: '100%' }}
                  >Guardar cliente</button>
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#8896A6', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 6 }}>Pasajeros (como en la reserva)</div>
            {(quote.pax || []).map((p, i) => (
              <div key={i} style={{ border: '1px solid #EAEFF4', borderRadius: 9, padding: 9, marginBottom: 8, background: '#FAFCFE' }}>
                <input value={p.name} onChange={e => onField('pax.' + i + '.name', e.target.value)} placeholder="Apellido / Nombre" style={{ ...inputSt, marginBottom: 7 }} />
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <select value={p.type} onChange={e => onField('pax.' + i + '.type', e.target.value)} style={{ flex: 1, minWidth: 0, border: '1px solid #D8E0E8', borderRadius: 8, padding: '7px 5px', fontSize: 12, color: '#15293F', background: '#fff', outline: 'none' }}>
                    <option>Adulto</option><option>Niño</option><option>Jubilado</option><option>Infante</option>
                  </select>
                  <select value={p.cabin} onChange={e => onField('pax.' + i + '.cabin', e.target.value)} style={{ flex: 1, minWidth: 0, border: '1px solid #D8E0E8', borderRadius: 8, padding: '7px 5px', fontSize: 12, color: '#15293F', background: '#fff', outline: 'none' }}>
                    <option>Económica</option><option>Premium Economy</option><option>Ejecutiva</option><option>Primera</option>
                  </select>
                  {(quote.pax || []).length > 1 && (
                    <button onClick={() => askDelete('¿Eliminar este pasajero?', () => onAction('removePax', i))} style={{ border: '1px solid #F0CFCF', background: '#fff', color: '#C0504D', width: 30, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>×</button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={() => onAction('addPax', 0)} style={{ border: '1px dashed #BFD3E6', background: '#fff', color: '#0F3D7A', fontWeight: 700, fontSize: 12, padding: '7px 0', borderRadius: 8, cursor: 'pointer', width: '100%' }}>+ Pasajero</button>
          </div>

          {/* Vendedor */}
          <div style={{ background: '#fff', border: '1px solid #EAEFF4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0F3D7A', marginBottom: 12 }}>Vendedor</div>
            <select value={quote.sellerIndex} onChange={e => onField('sellerIndex', parseInt(e.target.value))} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: '8px 9px', fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
              {SELLERS.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, background: '#EAF6FB', borderRadius: 9, padding: '9px 12px' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#134A99', color: '#fff', fontFamily: 'Archivo, sans-serif', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{seller.initials}</div>
              <div style={{ fontSize: 12, color: '#5B7186', lineHeight: 1.5 }}><span style={{ color: '#16A99C', fontWeight: 700 }}>{seller.phone}</span><br />{seller.email}</div>
            </div>
          </div>

          {/* Productos */}
          <div style={{ background: '#fff', border: '1px solid #EAEFF4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0F3D7A', marginBottom: 12 }}>Productos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
              {['flight', 'hotel', 'cruise', 'tour', 'transfer', 'car', 'insurance'].map(t => (
                <button key={t} onClick={() => onAction('add', 0, undefined, t)} style={{ border: '1px solid #BFE6F2', background: '#EAF6FB', color: '#0F3D7A', fontWeight: 700, fontSize: 12, padding: '7px 11px', borderRadius: 8, cursor: 'pointer' }}>
                  + {ITEM_LABELS[t]}
                </button>
              ))}
            </div>

            {(quote.items || []).map((item, idx) => (
              <div key={idx} style={{ border: '1px solid #E6ECF2', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F4F7FA', padding: '8px 10px' }}>
                  <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, color: '#15293F' }}>{ITEM_LABELS[item.type]}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => onAction('up', idx)} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#5B7186', width: 26, height: 26, borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>↑</button>
                    <button onClick={() => onAction('down', idx)} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#5B7186', width: 26, height: 26, borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>↓</button>
                    <button onClick={() => askDelete('¿Eliminar este elemento de la cotización?', () => onAction('remove', idx))} style={{ border: '1px solid #F0CFCF', background: '#fff', color: '#C0504D', width: 26, height: 26, borderRadius: 7, cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                </div>
                <div style={{ padding: 12 }}>

                  {/* FLIGHT editor */}
                  {item.type === 'flight' && (() => {
                    const fi = item as FlightItem
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 9, marginBottom: 10 }}>
                          <label style={{ display: 'block' }}><span style={labelSt}>Trayecto</span>
                            <select value={fi.dir} onChange={e => onField('items.' + idx + '.dir', e.target.value)} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: 7, fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
                              <option>Ida</option><option>Vuelta</option><option>Tramo interno</option>
                            </select>
                          </label>
                          <label style={{ display: 'block' }}><span style={labelSt}>Fecha</span><input value={fi.date} onChange={e => onField('items.' + idx + '.date', e.target.value)} placeholder="Lun 15 sep 2025" style={inputSt} /></label>
                        </div>
                        {fi.segments.map((seg, sidx) => (
                          <div key={sidx} style={{ background: '#FAFCFE', border: '1px solid #EAEFF4', borderRadius: 9, padding: 10, marginBottom: 9 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#16A99C', letterSpacing: '.06em' }}>SEGMENTO {sidx + 1}</span>
                              {fi.segments.length > 1 && (
                                <button onClick={() => askDelete('¿Quitar este segmento de vuelo?', () => onAction('removeSeg', idx, sidx))} style={{ border: 'none', background: 'none', color: '#C0504D', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Quitar</button>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1.2fr', gap: 8, marginBottom: 8 }}>
                              <label><span style={smLabelSt}>Aerolínea</span><input value={seg.airline} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.airline', e.target.value)} style={smInputSt} /></label>
                              <label><span style={smLabelSt}>N.º vuelo</span><input value={seg.flightNo} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.flightNo', e.target.value)} style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Alianza</span>
                                <select value={seg.alliance} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.alliance', e.target.value)} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 7, padding: '6px 4px', fontSize: 12, color: '#15293F', background: '#fff', outline: 'none' }}>
                                  <option>Star Alliance</option><option>SkyTeam</option><option>oneworld</option><option>—</option>
                                </select>
                              </label>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1.2fr .9fr', gap: 8, marginBottom: 8 }}>
                              <label><span style={smLabelSt}>Sale</span><input value={seg.from} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.from', e.target.value)} placeholder="PTY" style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Ciudad origen</span><input value={seg.fromCity} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.fromCity', e.target.value)} style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Hora salida</span><input value={seg.dep} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.dep', e.target.value)} placeholder="08:15" style={smInputSt} /></label>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '.8fr 1.2fr .9fr .6fr', gap: 8, marginBottom: 8 }}>
                              <label><span style={smLabelSt}>Llega</span><input value={seg.to} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.to', e.target.value)} placeholder="MAD" style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Ciudad destino</span><input value={seg.toCity} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.toCity', e.target.value)} style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Hora llegada</span><input value={seg.arr} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.arr', e.target.value)} placeholder="05:10" style={smInputSt} /></label>
                              <label><span style={smLabelSt}>+días</span><input value={seg.plus} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.plus', e.target.value)} placeholder="+1d" style={smInputSt} /></label>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 8, marginBottom: 8 }}>
                              <label><span style={smLabelSt}>Duración</span><input value={seg.duration} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.duration', e.target.value)} placeholder="9h 45m" style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Tipo de avión</span><input value={seg.aircraft} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.aircraft', e.target.value)} placeholder="Boeing 787-8" style={smInputSt} /></label>
                              <label><span style={smLabelSt}>Cabina</span>
                                <select value={seg.cabin} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.cabin', e.target.value)} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 7, padding: '6px 4px', fontSize: 12, color: '#15293F', background: '#fff', outline: 'none' }}>
                                  <option>Económica</option><option>Premium Economy</option><option>Ejecutiva</option><option>Primera</option>
                                </select>
                              </label>
                            </div>
                            <label><span style={smLabelSt}>Conexión después de este vuelo (opcional)</span><input value={seg.connectionAfter} onChange={e => onField('items.' + idx + '.segments.' + sidx + '.connectionAfter', e.target.value)} placeholder="Conexión en Bogotá · 1h 40m" style={smInputSt} /></label>
                          </div>
                        ))}
                        <button onClick={() => onAction('addSeg', idx)} style={{ border: '1px dashed #BFD3E6', background: '#fff', color: '#0F3D7A', fontWeight: 700, fontSize: 12, padding: '7px 0', borderRadius: 8, cursor: 'pointer', width: '100%', marginBottom: 8 }}>+ Agregar segmento / escala</button>
                        <label><span style={labelSt}>Equipaje incluido</span><input value={fi.baggage} onChange={e => onField('items.' + idx + '.baggage', e.target.value)} style={inputSt} /></label>
                      </>
                    )
                  })()}

                  {/* HOTEL editor */}
                  {item.type === 'hotel' && (() => {
                    const hi = item as HotelItem
                    return (
                      <>
                        <label style={{ display: 'block', marginBottom: 9 }}><span style={labelSt}>Nombre del hotel</span><input value={hi.name} onChange={e => onField('items.' + idx + '.name', e.target.value)} style={inputSt} /></label>
                        <label style={{ display: 'block', marginBottom: 9 }}><span style={labelSt}>Ubicación</span><input value={hi.location} onChange={e => onField('items.' + idx + '.location', e.target.value)} style={inputSt} /></label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Check-in</span><input value={hi.checkIn} onChange={e => onField('items.' + idx + '.checkIn', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Check-out</span><input value={hi.checkOut} onChange={e => onField('items.' + idx + '.checkOut', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Noches</span><input value={hi.nights} onChange={e => onField('items.' + idx + '.nights', e.target.value)} style={inputSt} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                          <label><span style={labelSt}>Habitación</span><input value={hi.roomType} onChange={e => onField('items.' + idx + '.roomType', e.target.value)} placeholder="Doble Superior" style={inputSt} /></label>
                          <label><span style={labelSt}>Régimen</span><input value={hi.board} onChange={e => onField('items.' + idx + '.board', e.target.value)} placeholder="Desayuno incluido" style={inputSt} /></label>
                        </div>
                        <div style={{ fontSize: 11, color: '#8896A6', marginTop: 8 }}>📷 Haz clic en los espacios de foto en el documento para agregar imágenes.</div>
                      </>
                    )
                  })()}

                  {/* CRUISE editor */}
                  {item.type === 'cruise' && (() => {
                    const ci = item as CruiseItem
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Naviera</span><input value={ci.line} onChange={e => onField('items.' + idx + '.line', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Barco</span><input value={ci.ship} onChange={e => onField('items.' + idx + '.ship', e.target.value)} style={inputSt} /></label>
                        </div>
                        <label style={{ display: 'block', marginBottom: 9 }}><span style={labelSt}>Itinerario</span><input value={ci.route} onChange={e => onField('items.' + idx + '.route', e.target.value)} placeholder="3 NIGHT BAHAMAS & PERFECT DAY CRUISE" style={inputSt} /></label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Zarpa</span><input value={ci.depart} onChange={e => onField('items.' + idx + '.depart', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Noches</span><input value={ci.nights} onChange={e => onField('items.' + idx + '.nights', e.target.value)} style={inputSt} /></label>
                        </div>
                        <label style={{ display: 'block', marginBottom: 9 }}><span style={labelSt}>Descripción del camarote</span><input value={ci.cabinLabel} onChange={e => onField('items.' + idx + '.cabinLabel', e.target.value)} placeholder="Balcón Vista al Mar para 4 personas" style={inputSt} /></label>
                        <label style={{ display: 'block', marginBottom: 9 }}><span style={labelSt}>Código camarote</span><input value={ci.cabin} onChange={e => onField('items.' + idx + '.cabin', e.target.value)} placeholder="XQ-GTY OCEAN VIEW BALCONY QUAD GTY" style={inputSt} /></label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Hora embarque</span><input value={ci.boardingTime} onChange={e => onField('items.' + idx + '.boardingTime', e.target.value)} placeholder="10:30 - 14:30" style={inputSt} /></label>
                          <label><span style={labelSt}>Promoción</span><input value={ci.promotion} onChange={e => onField('items.' + idx + '.promotion', e.target.value)} placeholder="Last Minute NRD" style={inputSt} /></label>
                        </div>
                        {/* Port itinerary */}
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: '#8896A6', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Itinerario de puertos</span>
                            <button onClick={() => onAction('addPort', idx)} style={{ fontSize: 11, color: '#16A99C', background: 'none', border: '1px solid #16A99C', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', fontWeight: 700 }}>+ Puerto</button>
                          </div>
                          {(ci.ports || []).map((p, pi) => (
                            <div key={pi} style={{ border: '1px solid #E6EDF3', borderRadius: 8, padding: '8px 10px', marginBottom: 6, background: '#FAFBFC' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, marginBottom: 5 }}>
                                <label><span style={labelSt}>Fecha</span><input value={p.date} onChange={e => onField('items.' + idx + '.ports.' + pi + '.date', e.target.value)} placeholder="07 ago 2026" style={inputSt} /></label>
                                <label><span style={labelSt}>Puerto</span><input value={p.port} onChange={e => onField('items.' + idx + '.ports.' + pi + '.port', e.target.value)} placeholder="NASSAU, BAHAMAS" style={inputSt} /></label>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, alignItems: 'end' }}>
                                <label><span style={labelSt}>Llegada</span><input value={p.arr} onChange={e => onField('items.' + idx + '.ports.' + pi + '.arr', e.target.value)} placeholder="09:00" style={inputSt} /></label>
                                <label><span style={labelSt}>Salida</span><input value={p.dep} onChange={e => onField('items.' + idx + '.ports.' + pi + '.dep', e.target.value)} placeholder="17:30" style={inputSt} /></label>
                                <button onClick={() => askDelete('¿Eliminar este puerto del itinerario?', () => onAction('removePort', idx, pi))} style={{ fontSize: 11, color: '#E0483E', background: 'none', border: '1px solid #E0483E', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', marginBottom: 1 }}>✕</button>
                              </div>
                            </div>
                          ))}
                          {(!ci.ports || ci.ports.length === 0) && <div style={{ fontSize: 11, color: '#B0B8C4', textAlign: 'center', padding: '8px 0' }}>Sin puertos — la IA los rellena al importar</div>}
                        </div>
                        <div style={{ fontSize: 11, color: '#8896A6', marginTop: 4 }}>📷 Foto del barco se busca automáticamente al ingresar el nombre. Haz clic en el espacio de foto en el documento para cambiarla.</div>
                      </>
                    )
                  })()}

                  {/* TOUR editor */}
                  {item.type === 'tour' && (() => {
                    const ti = item as TourItem
                    return (
                      <>
                        <label style={{ display: 'block', marginBottom: 9 }}><span style={labelSt}>Nombre del tour</span><input value={ti.name} onChange={e => onField('items.' + idx + '.name', e.target.value)} style={inputSt} /></label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Lugar</span><input value={ti.location} onChange={e => onField('items.' + idx + '.location', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Fecha</span><input value={ti.date} onChange={e => onField('items.' + idx + '.date', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Duración</span><input value={ti.duration} onChange={e => onField('items.' + idx + '.duration', e.target.value)} style={inputSt} /></label>
                        </div>
                        <label><span style={labelSt}>Incluye</span><input value={ti.includes} onChange={e => onField('items.' + idx + '.includes', e.target.value)} placeholder="Guía, transporte, entradas" style={inputSt} /></label>
                      </>
                    )
                  })()}

                  {/* CAR editor */}
                  {item.type === 'car' && (() => {
                    const ca = item as CarItem
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Categoría</span><input value={ca.category} onChange={e => onField('items.' + idx + '.category', e.target.value)} placeholder="Intermediate SUV" style={inputSt} /></label>
                          <label><span style={labelSt}>Modelo</span><input value={ca.model} onChange={e => onField('items.' + idx + '.model', e.target.value)} placeholder="Mazda CX-50 o similar" style={inputSt} /></label>
                          <label><span style={labelSt}>Promoción</span><input value={ca.promotion} onChange={e => onField('items.' + idx + '.promotion', e.target.value)} placeholder="PROMO ★★★" style={inputSt} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Recogida</span><input value={ca.pickupDate} onChange={e => onField('items.' + idx + '.pickupDate', e.target.value)} placeholder="Lun 21 jul" style={inputSt} /></label>
                          <label><span style={labelSt}>Devolución</span><input value={ca.returnDate} onChange={e => onField('items.' + idx + '.returnDate', e.target.value)} placeholder="Jue 7 ago" style={inputSt} /></label>
                          <label><span style={labelSt}>Días</span><input value={ca.days} onChange={e => onField('items.' + idx + '.days', e.target.value)} placeholder="17" style={inputSt} /></label>
                          <label><span style={labelSt}>Protección</span><input value={ca.protection} onChange={e => onField('items.' + idx + '.protection', e.target.value)} placeholder="Protección Total" style={inputSt} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Lugar de recogida</span><input value={ca.pickupLocation} onChange={e => onField('items.' + idx + '.pickupLocation', e.target.value)} placeholder="En Terminal" style={inputSt} /></label>
                          <label><span style={labelSt}>Lugar de devolución</span><input value={ca.dropoffLocation} onChange={e => onField('items.' + idx + '.dropoffLocation', e.target.value)} placeholder="En Terminal" style={inputSt} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 9 }}>
                          <label><span style={labelSt}>Pasajeros</span><input value={ca.passengers} onChange={e => onField('items.' + idx + '.passengers', e.target.value)} placeholder="5" style={inputSt} /></label>
                          <label><span style={labelSt}>Maletas</span><input value={ca.bags} onChange={e => onField('items.' + idx + '.bags', e.target.value)} placeholder="3" style={inputSt} /></label>
                          <label><span style={labelSt}>Puertas</span><input value={ca.doors} onChange={e => onField('items.' + idx + '.doors', e.target.value)} placeholder="4" style={inputSt} /></label>
                          <label><span style={labelSt}>A/C</span>
                            <select value={ca.ac} onChange={e => onField('items.' + idx + '.ac', e.target.value)} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: '7px 5px', fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
                              <option>Sí</option><option>No</option>
                            </select>
                          </label>
                          <label><span style={labelSt}>Transmisión</span>
                            <select value={ca.transmission} onChange={e => onField('items.' + idx + '.transmission', e.target.value)} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: '7px 5px', fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
                              <option>Automático</option><option>Manual</option>
                            </select>
                          </label>
                        </div>
                      </>
                    )
                  })()}

                  {/* INSURANCE editor */}
                  {item.type === 'insurance' && (() => {
                    const ins = item as InsuranceItem
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Aseguradora</span><input value={ins.company} onChange={e => onField('items.' + idx + '.company', e.target.value)} placeholder="Assist Card, AXA, Generali…" style={inputSt} /></label>
                          <label><span style={labelSt}>Plan</span><input value={ins.plan} onChange={e => onField('items.' + idx + '.plan', e.target.value)} placeholder="Plan Premium" style={inputSt} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Inicio</span><input value={ins.startDate} onChange={e => onField('items.' + idx + '.startDate', e.target.value)} placeholder="Lun 21 jul 2026" style={inputSt} /></label>
                          <label><span style={labelSt}>Fin</span><input value={ins.endDate} onChange={e => onField('items.' + idx + '.endDate', e.target.value)} placeholder="Vie 1 ago 2026" style={inputSt} /></label>
                          <label><span style={labelSt}>Días</span><input value={ins.days} onChange={e => onField('items.' + idx + '.days', e.target.value)} placeholder="12" style={inputSt} /></label>
                        </div>
                        <label style={{ display: 'block' }}><span style={labelSt}>Destino</span><input value={ins.destination} onChange={e => onField('items.' + idx + '.destination', e.target.value)} placeholder="Europa, Worldwide, USA…" style={inputSt} /></label>
                        <label style={{ display: 'block', marginTop: 9 }}><span style={labelSt}>Coberturas incluidas</span><input value={ins.coverage} onChange={e => onField('items.' + idx + '.coverage', e.target.value)} placeholder="Médica, cancelación, equipaje, responsabilidad civil…" style={inputSt} /></label>
                      </>
                    )
                  })()}

                  {/* TRANSFER editor */}
                  {item.type === 'transfer' && (() => {
                    const tr = item as TransferItem
                    return (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
                          <label><span style={labelSt}>Desde</span><input value={tr.from} onChange={e => onField('items.' + idx + '.from', e.target.value)} placeholder="Aeropuerto MAD" style={inputSt} /></label>
                          <label><span style={labelSt}>Hasta</span><input value={tr.to} onChange={e => onField('items.' + idx + '.to', e.target.value)} placeholder="Hotel centro" style={inputSt} /></label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
                          <label><span style={labelSt}>Fecha</span><input value={tr.date} onChange={e => onField('items.' + idx + '.date', e.target.value)} style={inputSt} /></label>
                          <label><span style={labelSt}>Vehículo</span><input value={tr.vehicle} onChange={e => onField('items.' + idx + '.vehicle', e.target.value)} placeholder="Van privada" style={inputSt} /></label>
                          <label><span style={labelSt}>Tipo</span>
                            <select value={tr.mode} onChange={e => onField('items.' + idx + '.mode', e.target.value)} style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: '7px 5px', fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
                              <option>Privado</option><option>Compartido</option>
                            </select>
                          </label>
                        </div>
                      </>
                    )
                  })()}

                </div>
              </div>
            ))}
          </div>

          {/* Comentarios + IA */}
          <div style={{ background: '#fff', border: '1px solid #EAEFF4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0F3D7A', marginBottom: 10 }}>Comentarios</div>
            <textarea
              value={quote.comments || ''}
              onChange={e => setQuote(q => ({ ...q, comments: e.target.value }))}
              placeholder="Notas o comentarios para el cliente (aparecen en el documento)..."
              rows={3}
              style={{ width: '100%', border: '1px solid #D8E0E8', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#15293F', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div
              style={{ marginTop: 12, borderTop: '1px solid #EDF1F5', paddingTop: 12 }}
              onPaste={e => {
                const images = Array.from(e.clipboardData.items).filter(it => it.kind === 'file' && it.type.startsWith('image/'))
                const files = images.map(it => it.getAsFile()).filter(Boolean) as File[]
                if (files.length) { setAiFiles(prev => [...prev, ...files]); setAiMsg('') }
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0F3D7A', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>✨ Asistente IA</div>
              <div style={{ fontSize: 11, color: '#9AA8B8', marginBottom: 8 }}>Escribe tu instrucción, adjunta una imagen o PDF, o pega con Cmd+V</div>

              {/* Archivos adjuntos */}
              {aiFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {aiFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EAF6FB', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                      <span style={{ color: '#0F3D7A', fontWeight: 600 }}>{f.type.startsWith('image/') ? '🖼' : '📄'} {f.name.length > 20 ? f.name.slice(0, 18) + '…' : f.name}</span>
                      <button onClick={() => setAiFiles(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: '#9AA8B8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {/* Botón adjuntar */}
                <label style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: '1px solid #D8E0E8', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 16 }} title="Adjuntar imagen o PDF">
                  📎
                  <input type="file" multiple accept="image/*,application/pdf,.pdf" style={{ display: 'none' }}
                    onChange={e => { setAiFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = '' }} />
                </label>
                <input
                  value={aiCmd}
                  onChange={e => setAiCmd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAiEdit()}
                  placeholder='Ej: "agrega un traslado al aeropuerto el 10 de julio"'
                  style={{ flex: 1, border: '1px solid #D8E0E8', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#15293F', outline: 'none' }}
                  disabled={aiBusy}
                />
                <button
                  onClick={sendAiEdit}
                  disabled={aiBusy || (!aiCmd.trim() && aiFiles.length === 0)}
                  style={{ background: aiBusy || (!aiCmd.trim() && aiFiles.length === 0) ? '#C8D5E2' : '#0F3D7A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: aiBusy || (!aiCmd.trim() && aiFiles.length === 0) ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {aiBusy ? '...' : 'Enviar'}
                </button>
              </div>
              {aiMsg && (
                <div style={{ marginTop: 8, fontSize: 11, color: aiMsg.startsWith('Error') ? '#D94F4F' : '#1A8A6E', background: aiMsg.startsWith('Error') ? '#FEF2F2' : '#F0FBF8', borderRadius: 6, padding: '6px 10px' }}>
                  {aiMsg}
                </div>
              )}
            </div>
          </div>

          {/* Precio */}
          <div style={{ background: '#fff', border: '1px solid #EAEFF4', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#0F3D7A', marginBottom: 12 }}>Precios</div>

            {([['priceAdulto', 'Adulto', adultoCount], ['priceNino', 'Niño', ninoCount], ['priceJubilado', 'Jubilado', jubCount], ['priceInfante', 'Infante', infanteCount]] as [keyof QuoteDoc, string, number][]).map(([field, label, cnt]) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#5B7186', flex: 1 }}>{label}</span>
                  <input
                    value={(quote[field] as number) || 0}
                    onChange={e => onField(field as string, parseFloat(e.target.value) || 0)}
                    type="number"
                    style={{ width: 110, border: '1px solid #D8E0E8', borderRadius: 8, padding: '6px 9px', fontSize: 13, color: '#15293F', background: '#fff', outline: 'none', textAlign: 'right', fontFamily: 'Manrope, sans-serif' }}
                  />
                </div>
                {cnt > 0 && (quote[field] as number) > 0 && (
                  <div style={{ fontSize: 11, color: '#16A99C', textAlign: 'right', marginTop: 3 }}>
                    {cnt} × {money(quote[field] as number, quote.currency)} = {money(cnt * (quote[field] as number), quote.currency)}
                  </div>
                )}
              </div>
            ))}

            <div style={{ borderTop: '1px solid #EAEFF4', marginTop: 6, paddingTop: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F3D7A' }}>Total calculado</span>
              <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F3D7A' }}>{totalFmt}</span>
            </div>
            <div style={{ background: '#0F3D7A', borderRadius: 10, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)', letterSpacing: '.06em', marginBottom: 2 }}>TOTAL · {quote.currency}</div>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 22, fontWeight: 800, color: '#9EE7DE' }}>{totalFmt}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.65)', letterSpacing: '.06em', marginBottom: 2 }}>POR PASAJERO</div>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 16, fontWeight: 800, color: '#fff' }}>{perPaxFmt}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── DOCUMENT (right panel) ────────────────────────────────────── */}
        <div id="docscroll" style={{ flex: 1, overflowY: 'auto', background: '#e7e5df', padding: 32, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div id="doc" style={{ width: 800, flexShrink: 0, background: '#fff', boxShadow: '0 4px 24px rgba(15,61,122,.10)', overflow: 'hidden' }}>

            {/* Top bar */}
            <div style={{ padding: '26px 38px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #16A99C' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpg" alt="CE Viaja" style={{ height: 72, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.2em', color: '#16A99C' }}>COTIZACIÓN DE VIAJE</div>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 21, fontWeight: 800, color: '#0F3D7A' }}>N.º {quote.number}</div>
              </div>
            </div>

            <div style={{ display: 'flex' }}>
              {/* Main content */}
              <div style={{ flex: 1, padding: '28px 32px', borderRight: '1px solid #EDF1F5', minWidth: 0 }}>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 23, fontWeight: 800, color: '#0F3D7A' }}>{quote.client || <span style={{ color: '#C0CCDA' }}>Nombre del cliente</span>}</div>
                <div style={{ fontSize: 13, color: '#5B7186', marginTop: 2, marginBottom: 14 }}>{paxSummary} · clase {cabinSummary}</div>

                <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, padding: '11px 14px', marginBottom: 22 }}>
                  <div style={{ fontSize: 11, color: '#9AA8B8', letterSpacing: '.08em', marginBottom: 6 }}>PASAJEROS</div>
                  {(quote.pax || []).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#15293F', padding: '4px 0' }}>
                      <span style={{ fontWeight: 600 }}>{i + 1}.&nbsp;&nbsp;{(p.name || '').toUpperCase()}</span>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: '#5B7186', fontSize: 12 }}>{p.cabin}</span>
                        <span style={{ color: '#16A99C', fontWeight: 700, fontSize: 11, letterSpacing: '.06em' }}>{PAX_CODE[p.type] || 'ADT'}</span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Items in document */}
                {(quote.items || []).map((item, idx) => (
                  <div key={idx} style={{ marginBottom: 20 }}>

                    {/* FLIGHT doc */}
                    {item.type === 'flight' && (() => {
                      const fi = item as FlightItem
                      const first = fi.segments[0], last = fi.segments[fi.segments.length - 1]
                      // Multi-segment: sum parts (most reliable); single segment: timezone-aware calc
                      const totalDur = fi.segments.length > 1
                        ? totalFlightDuration(fi.segments)
                        : (first && last ? calcFlightDuration(first.from, first.dep, last.to, last.arr, fi.date, last.plus) : null)
                            ?? totalFlightDuration(fi.segments)
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
                            <div style={{ background: '#0F3D7A', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6 }}>{(fi.dir || '').toUpperCase()} · {fi.date}</div>
                            {totalDur && (
                              <div style={{ fontSize: 12, color: '#5B7186', fontWeight: 700 }}>⏱ {totalDur} en total</div>
                            )}
                          </div>
                          {fi.segments.map((seg, sidx) => (
                            <div key={sidx}>
                              <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                                <div style={{ background: '#F6F9FB', padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#15293F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>{seg.airline} · {seg.flightNo}</span>
                                  <span style={{ color: '#16A99C' }}>{seg.alliance}</span>
                                </div>
                                <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 16px' }}>
                                  <div><div style={{ fontSize: 11, color: '#4A6580' }}>SALE · {seg.from} {seg.fromCity}</div><div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 18, fontWeight: 700, color: '#15293F' }}>{seg.dep}</div></div>
                                  <div><div style={{ fontSize: 11, color: '#4A6580' }}>LLEGA · {seg.to} {seg.toCity}</div><div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 18, fontWeight: 700, color: '#15293F' }}>{seg.arr} <span style={{ fontSize: 11, color: '#16A99C' }}>{seg.plus}</span></div></div>
                                  <div style={{ fontSize: 12, color: '#5B7186' }}>Duración {seg.duration}</div>
                                  <div style={{ fontSize: 12, color: '#5B7186' }}>{seg.aircraft} · {seg.cabin}</div>
                                </div>
                              </div>
                              {seg.connectionAfter && (
                                <div style={{ fontSize: 12, color: '#B08400', background: '#FBF6E9', borderRadius: 6, padding: '7px 14px', marginBottom: 10 }}>⏱ {seg.connectionAfter}</div>
                              )}
                            </div>
                          ))}
                          <div style={{ fontSize: 12, color: '#5B7186', paddingTop: 2 }}>🧳 {fi.baggage}</div>
                        </>
                      )
                    })()}

                    {/* HOTEL doc */}
                    {item.type === 'hotel' && (() => {
                      const hi = item as HotelItem
                      return (
                        <>
                          <div style={{ marginBottom: 13 }}>
                            <div style={{ background: '#16A99C', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6, display: 'inline-block' }}>HOTEL · {hi.name}</div>
                          </div>
                          <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', borderBottom: '1px solid #EDF1F5' }}>
                              <div style={{ gridColumn: 'span 2' }}><div style={{ fontSize: 11, color: '#9AA8B8' }}>UBICACIÓN</div><div style={{ fontSize: 14, fontWeight: 600, color: '#15293F' }}>{hi.location}</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>CHECK-IN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.checkIn}</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>CHECK-OUT</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.checkOut}</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>HABITACIÓN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.roomType}</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>RÉGIMEN · {hi.nights} noches</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.board}</div></div>
                            </div>
                            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div style={{ height: 140 }}>
                                <ImageSlot id={`h${idx}-p1`} placeholder="Foto habitación" photos={hotelPhotos} onChange={(id, src) => setHotelPhotos(p => ({ ...p, [id]: src }))} />
                              </div>
                              <div style={{ height: 140 }}>
                                <ImageSlot id={`h${idx}-p2`} placeholder="Foto hotel" photos={hotelPhotos} onChange={(id, src) => setHotelPhotos(p => ({ ...p, [id]: src }))} />
                              </div>
                              <div style={{ height: 150, gridColumn: 'span 2' }}>
                                <ImageSlot id={`h${idx}-map`} placeholder="Mapa de ubicación" photos={hotelPhotos} onChange={(id, src) => setHotelPhotos(p => ({ ...p, [id]: src }))} />
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}

                    {/* CRUISE doc */}
                    {item.type === 'cruise' && (() => {
                      const ci = item as CruiseItem
                      const autoExt = shipAutoPhoto[`${idx}-ext`]
                      const autoCabin = shipAutoPhoto[`${idx}-cabin`]
                      const extSrc = cruisePhotos[`cr${idx}-ext`] || autoExt
                      const cabinSrc = cruisePhotos[`cr${idx}-cabin`] || autoCabin
                      return (
                        <>
                          {/* Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
                            <div style={{ background: '#134A99', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6 }}>CRUCERO · {ci.line}</div>
                            {ci.nights && <div style={{ fontSize: 12, color: '#5B7186', fontWeight: 700 }}>🚢 {ci.nights} noches</div>}
                          </div>

                          {/* Photo */}
                          <div style={{ height: 200, marginBottom: 14 }}>
                            <ImageSlot
                              id={`cr${idx}-ext`}
                              placeholder="Foto del barco"
                              photos={extSrc ? { [`cr${idx}-ext`]: extSrc } : cruisePhotos}
                              onChange={(id, src) => setCruisePhotos(p => ({ ...p, [id]: src }))}
                            />
                          </div>

                          {/* Info grid */}
                          <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                            {/* Ship + route */}
                            <div style={{ padding: '10px 14px', borderBottom: '1px solid #EDF1F5' }}>
                              <div style={{ fontSize: 11, color: '#9AA8B8', marginBottom: 3 }}>BARCO · ITINERARIO</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#15293F' }}>{ci.ship}</div>
                              <div style={{ fontSize: 13, color: '#5B7186', marginTop: 2 }}>{ci.route}</div>
                            </div>
                            {/* Zarpa / Duración / Embarque */}
                            <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 14px', borderBottom: '1px solid #EDF1F5' }}>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>ZARPA</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ci.depart}</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>DURACIÓN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ci.nights} noches</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>EMBARQUE</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ci.boardingTime || '—'}</div></div>
                            </div>
                            {/* Cabin: label prominent + code small */}
                            <div style={{ padding: '10px 14px', borderBottom: ci.promotion ? '1px solid #EDF1F5' : undefined }}>
                              <div style={{ fontSize: 11, color: '#9AA8B8', marginBottom: 4 }}>CAMAROTE</div>
                              {ci.cabinLabel && (
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0F3D7A', marginBottom: 4 }}>{ci.cabinLabel}</div>
                              )}
                              {ci.cabin && (
                                <div style={{ fontSize: 10, color: '#9AA8B8', letterSpacing: '.03em' }}>{ci.cabin}</div>
                              )}
                            </div>
                            {/* Promotion */}
                            {ci.promotion && (
                              <div style={{ padding: '8px 14px', background: '#F0FBF9', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 10, color: '#16A99C', fontWeight: 700, letterSpacing: '.06em' }}>PROMOCIÓN</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#0E7E75' }}>{ci.promotion}</span>
                              </div>
                            )}
                          </div>

                          {/* Port itinerary table */}
                          {ci.ports && ci.ports.length > 0 && (
                            <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ padding: '8px 14px', background: '#134A99' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: 700, letterSpacing: '.08em' }}>ITINERARIO DE PUERTOS</div>
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: '#F6F9FB' }}>
                                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: '#9AA8B8', fontWeight: 700, letterSpacing: '.06em' }}>FECHA</th>
                                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: '#9AA8B8', fontWeight: 700, letterSpacing: '.06em' }}>PUERTO</th>
                                    <th style={{ padding: '7px 12px', textAlign: 'center', fontSize: 10, color: '#9AA8B8', fontWeight: 700, letterSpacing: '.06em' }}>LLEGADA</th>
                                    <th style={{ padding: '7px 12px', textAlign: 'center', fontSize: 10, color: '#9AA8B8', fontWeight: 700, letterSpacing: '.06em' }}>SALIDA</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ci.ports.map((p, pi) => (
                                    <tr key={pi} style={{ borderTop: '1px solid #EDF1F5', background: pi % 2 === 0 ? '#fff' : '#FAFBFD' }}>
                                      <td style={{ padding: '9px 12px', color: '#5B7186', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.date}</td>
                                      <td style={{ padding: '9px 12px', color: '#15293F', fontWeight: 600 }}>{p.port}</td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center', color: '#15293F', fontFamily: 'Archivo, sans-serif', fontWeight: 700 }}>{p.arr || '—'}</td>
                                      <td style={{ padding: '9px 12px', textAlign: 'center', color: '#15293F', fontFamily: 'Archivo, sans-serif', fontWeight: 700 }}>{p.dep || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      )
                    })()}

                    {/* TOUR doc */}
                    {item.type === 'tour' && (() => {
                      const ti = item as TourItem
                      return (
                        <>
                          <div style={{ marginBottom: 13 }}>
                            <div style={{ background: '#16A99C', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6, display: 'inline-block' }}>TOUR · {ti.name}</div>
                          </div>
                          <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 16px' }}>
                            <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>LUGAR</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ti.location}</div></div>
                            <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>FECHA · DURACIÓN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ti.date} · {ti.duration}</div></div>
                            <div style={{ gridColumn: 'span 2' }}><div style={{ fontSize: 11, color: '#9AA8B8' }}>INCLUYE</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ti.includes}</div></div>
                          </div>
                        </>
                      )
                    })()}

                    {/* CAR doc */}
                    {item.type === 'car' && (() => {
                      const ca = item as CarItem
                      return (
                        <>
                          <div style={{ marginBottom: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ background: '#16A99C', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6 }}>ALQUILER DE CARRO</div>
                            {ca.promotion && <div style={{ background: '#FFF3CD', color: '#856404', fontFamily: 'Archivo, sans-serif', fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6 }}>{ca.promotion}</div>}
                          </div>
                          <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', gap: 16, padding: 16 }}>
                              {/* Car photo */}
                              <div style={{ width: 180, flexShrink: 0, height: 120 }}>
                                <ImageSlot id={`car${idx}-photo`} placeholder="Foto del carro" photos={carPhotos} onChange={(id, src) => setCarPhotos(p => ({ ...p, [id]: src }))} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                  <div>
                                    {ca.category && <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 15, fontWeight: 800, color: '#0F3D7A' }}>{ca.category}</div>}
                                    {ca.model && <div style={{ fontSize: 13, color: '#5B7186', marginTop: 2 }}>{ca.model}</div>}
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    {ca.days && <div style={{ fontSize: 12, color: '#9AA8B8' }}>{ca.days} días</div>}
                                    {ca.protection && <div style={{ fontSize: 12, fontWeight: 700, color: '#16A99C' }}>{ca.protection}</div>}
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 10 }}>
                                  {ca.pickupDate && <div><div style={{ fontSize: 10, color: '#9AA8B8' }}>RECOGIDA</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15293F' }}>{ca.pickupDate}{ca.pickupLocation ? ' · ' + ca.pickupLocation : ''}</div></div>}
                                  {ca.returnDate && <div><div style={{ fontSize: 10, color: '#9AA8B8' }}>DEVOLUCIÓN</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15293F' }}>{ca.returnDate}{ca.dropoffLocation ? ' · ' + ca.dropoffLocation : ''}</div></div>}
                                </div>
                                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                  {ca.passengers && <div style={{ fontSize: 12, color: '#5B7186' }}>👤 {ca.passengers}</div>}
                                  {ca.bags && <div style={{ fontSize: 12, color: '#5B7186' }}>🧳 {ca.bags}</div>}
                                  {ca.doors && <div style={{ fontSize: 12, color: '#5B7186' }}>🚪 {ca.doors} puertas</div>}
                                  {ca.ac === 'Sí' && <div style={{ fontSize: 12, color: '#5B7186' }}>❄️ A/C</div>}
                                  {ca.transmission && <div style={{ fontSize: 12, color: '#5B7186' }}>⚙️ {ca.transmission}</div>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}

                    {/* INSURANCE doc */}
                    {item.type === 'insurance' && (() => {
                      const ins = item as InsuranceItem
                      return (
                        <>
                          <div style={{ marginBottom: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ background: '#1A6B3C', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6 }}>SEGURO DE VIAJE</div>
                            {ins.company && <div style={{ fontSize: 13, fontWeight: 700, color: '#1A6B3C' }}>{ins.company}</div>}
                          </div>
                          <div style={{ border: '1px solid #D1E8D8', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ background: '#F0FAF3', padding: '10px 16px', borderBottom: '1px solid #D1E8D8' }}>
                              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 15, fontWeight: 800, color: '#1A6B3C' }}>{ins.plan}</div>
                              {ins.destination && <div style={{ fontSize: 12, color: '#5B7186', marginTop: 2 }}>Destino: {ins.destination}</div>}
                            </div>
                            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
                              {ins.startDate && <div><div style={{ fontSize: 10, color: '#9AA8B8' }}>INICIO</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15293F' }}>{ins.startDate}</div></div>}
                              {ins.endDate && <div><div style={{ fontSize: 10, color: '#9AA8B8' }}>FIN</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15293F' }}>{ins.endDate}</div></div>}
                              {ins.days && <div><div style={{ fontSize: 10, color: '#9AA8B8' }}>DÍAS</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15293F' }}>{ins.days} días</div></div>}
                              {ins.coverage && <div style={{ gridColumn: 'span 3' }}><div style={{ fontSize: 10, color: '#9AA8B8' }}>COBERTURAS</div><div style={{ fontSize: 12, fontWeight: 600, color: '#15293F' }}>{ins.coverage}</div></div>}
                            </div>
                          </div>
                        </>
                      )
                    })()}

                    {/* TRANSFER doc */}
                    {item.type === 'transfer' && (() => {
                      const tr = item as TransferItem
                      return (
                        <>
                          <div style={{ marginBottom: 13 }}>
                            <div style={{ background: '#0F3D7A', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6, display: 'inline-block' }}>TRASLADO {tr.mode}</div>
                          </div>
                          <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>RECORRIDO</div><div style={{ fontSize: 14, fontWeight: 600, color: '#15293F' }}>{tr.from} → {tr.to}</div></div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: '#9AA8B8' }}>{tr.date}</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#16A99C' }}>{tr.vehicle}</div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ))}
              </div>

              {/* Sidebar */}
              <div style={{ width: 252, flexShrink: 0, background: '#fff', padding: '28px 24px' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800 }}>Resumen</div>
                <div style={{ marginTop: 14, fontSize: 13, color: '#15293F', lineHeight: 1.95 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Pasajeros</span><span style={{ fontWeight: 700 }}>{paxSummary}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Clase</span><span style={{ fontWeight: 700 }}>{cabinSummary}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Vigencia</span><span style={{ fontWeight: 700 }}>{quote.validez}</span></div>
                </div>

                {/* Comments */}
                {quote.comments?.trim() && (
                  <>
                    <div style={{ height: 1, background: '#EDF1F5', margin: '18px 0' }} />
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800, marginBottom: 8 }}>Comentarios</div>
                    <div style={{ fontSize: 12, color: '#5B7186', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{quote.comments}</div>
                  </>
                )}

                {/* Per-type price breakdown */}
                {(quote.priceAdulto > 0 || quote.priceNino > 0 || quote.priceJubilado > 0) && (
                  <>
                    <div style={{ height: 1, background: '#EDF1F5', margin: '18px 0' }} />
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800, marginBottom: 10 }}>Precio por pasajero</div>
                    <div style={{ fontSize: 13, color: '#15293F', lineHeight: 2 }}>
                      {quote.priceAdulto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Adulto (ADT)</span><span style={{ fontWeight: 700 }}>{money(quote.priceAdulto, quote.currency)}</span></div>}
                      {quote.priceNino > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Niño (CHD)</span><span style={{ fontWeight: 700 }}>{money(quote.priceNino, quote.currency)}</span></div>}
                      {quote.priceJubilado > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Jubilado (JUB)</span><span style={{ fontWeight: 700 }}>{money(quote.priceJubilado, quote.currency)}</span></div>}
                      {quote.priceInfante > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Infante (INF)</span><span style={{ fontWeight: 700 }}>{money(quote.priceInfante, quote.currency)}</span></div>}
                    </div>
                  </>
                )}

                <div style={{ height: 1, background: '#EDF1F5', margin: '18px 0' }} />
                <div style={{ background: '#0F3D7A', color: '#fff', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, opacity: .8, letterSpacing: '.04em', marginBottom: 2 }}>TOTAL · {quote.currency}</div>
                  <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 27, fontWeight: 800, color: '#9EE7DE', marginBottom: 10 }}>{totalFmt}</div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,.15)', marginBottom: 10 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, opacity: .8, letterSpacing: '.04em' }}>POR PASAJERO</span>
                    <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: 15, fontWeight: 800, color: '#fff' }}>{perPaxFmt}</span>
                  </div>
                </div>

                <div style={{ height: 1, background: '#EDF1F5', margin: '20px 0' }} />
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800 }}>Tu asesor</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#134A99', color: '#fff', fontFamily: 'Archivo, sans-serif', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{seller.initials}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 14, fontWeight: 700, color: '#15293F' }}>{seller.name}</div>
                    <div style={{ fontSize: 12, color: '#16A99C', fontWeight: 700 }}>{seller.phone}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#5B7186', marginTop: 9, wordBreak: 'break-all' }}>{seller.email}</div>

                <div style={{ height: 1, background: '#EDF1F5', margin: '20px 0' }} />
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800 }}>Cuentas para pagos</div>
                <div style={{ background: '#EAF6FB', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
                  <div style={{ fontSize: 10, color: '#7A8AA0', textTransform: 'uppercase', letterSpacing: '.06em' }}>Nombre de la cuenta</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>C VIAJA, S.A.</div>
                  <div style={{ fontSize: 10, color: '#7A8AA0', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 6 }}>Tipo de cuenta</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>Corriente</div>
                  <div style={{ height: 1, background: '#C7E2EF', margin: '11px 0' }} />
                  <div style={{ marginBottom: 9 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F3D7A' }}>Banco General</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F', fontFamily: 'Archivo, sans-serif', letterSpacing: '.02em' }}>03-02-01-126429-0</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F3D7A' }}>Global Bank</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F', fontFamily: 'Archivo, sans-serif', letterSpacing: '.02em' }}>21-101-22397-0</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 32px 18px', background: '#0F3D7A', color: '#9FC0E8', fontSize: 10, lineHeight: 1.65 }}>
              <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', marginBottom: 8 }}>
                CE Viaja · Asesoría experta en cada viaje · Cotización válida {quote.validez}
              </div>
              <div style={{ borderTop: '1px solid rgba(159,192,232,.25)', paddingTop: 9, color: 'rgba(159,192,232,.82)' }}>
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase' }}>Términos y Condiciones</div>
                <div>• Tarifas no reembolsables y sujetas a penalidades por cambios.</div>
                <div>• La presente es únicamente una cotización; tarifas y disponibilidad pueden variar sin previo aviso hasta la emisión y confirmación de la reserva.</div>
                <div>• Es responsabilidad del pasajero contar con un pasaporte con vigencia mínima de seis (6) meses y cumplir con todos los requisitos migratorios y sanitarios aplicables, incluyendo visas, vacunas (como fiebre amarilla), ESTA, eTA u otras autorizaciones de viaje.</div>
                <div>• C. Viaja, S.A. no se hace responsable por la falta de documentación requerida ni por gastos adicionales no contemplados expresamente dentro del paquete contratado.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: AI IMPORT ─────────────────────────────────────────────── */}
      {showImport && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,63,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
          onPaste={e => {
            const items = Array.from(e.clipboardData.items)
            const images = items.filter(it => it.kind === 'file' && it.type.startsWith('image/'))
            if (images.length === 0) return
            const files = images.map(it => it.getAsFile()).filter(Boolean) as File[]
            setImportFiles(prev => [...prev, ...files])
            setImportError('')
          }}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.32)' }}>
            <div style={{ padding: '22px 24px', borderBottom: '1px solid #EDF1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 17, fontWeight: 800, color: '#0F3D7A' }}>✨ Rellenar con IA</div>
              <button onClick={() => { setShowImport(false); setImportBusy(false); setImportFiles([]) }} style={{ border: 'none', background: 'none', fontSize: 22, color: '#9AA8B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '22px 24px' }}>
              <div style={{ fontSize: 13, color: '#5B7186', lineHeight: 1.6, marginBottom: 6 }}>Sube <b>fotos, PDFs o documentos</b> (varios a la vez) o <b>pega el texto</b> y la IA rellena la cotización sola. Reconoce:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {['Itinerario Sabre', 'Pasaporte', 'Hotel', 'Crucero', 'Tour / Traslado', 'Precios y tarifas'].map(t => (
                  <span key={t} style={{ fontSize: 11, color: '#0F3D7A', background: '#EAF6FB', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{t}</span>
                ))}
                {['JPG/PNG', 'PDF', 'TXT'].map(t => (
                  <span key={t} style={{ fontSize: 11, color: '#5B7186', background: '#F1F5F9', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
              {/* Drop zone */}
              <label
                style={{ display: 'block', border: '1.5px dashed #BFD3E6', borderRadius: 10, padding: 18, textAlign: 'center', cursor: 'pointer', background: '#F7FBFD', marginBottom: importFiles.length > 0 ? 10 : 14 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const files = Array.from(e.dataTransfer.files)
                  setImportFiles(prev => [...prev, ...files])
                  setImportError('')
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.pdf,text/plain,.txt,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files || [])
                    setImportFiles(prev => [...prev, ...files])
                    setImportError('')
                    e.target.value = ''
                  }}
                />
                <div style={{ fontSize: 13, color: '#0F3D7A', fontWeight: 700 }}>📎 Agregar fotos, PDF o documentos</div>
                <div style={{ fontSize: 11, color: '#9AA8B8', marginTop: 4 }}>Selecciona, arrastra o <b style={{ color: '#0F3D7A' }}>pega una imagen con Cmd+V / Ctrl+V</b></div>
              </label>

              {/* File list */}
              {importFiles.length > 0 && (
                <div style={{ border: '1px solid #E6ECF2', borderRadius: 10, padding: '10px 12px', marginBottom: 14, background: '#FAFCFE' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#0F3D7A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{importFiles.length} archivo{importFiles.length > 1 ? 's' : ''} seleccionado{importFiles.length > 1 ? 's' : ''}</span>
                    <button onClick={() => setImportFiles([])} style={{ border: 'none', background: 'none', fontSize: 11, color: '#C0504D', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Quitar todos</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {importFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#EAF6FB', borderRadius: 8, padding: '5px 10px' }}>
                        <span style={{ fontSize: 12, color: '#0F3D7A', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.type.startsWith('image/') ? '🖼 ' : '📄 '}{f.name.length > 38 ? f.name.slice(0, 35) + '…' : f.name}
                        </span>
                        <button
                          onClick={() => setImportFiles(prev => prev.filter((_, j) => j !== i))}
                          style={{ border: 'none', background: 'none', color: '#9AA8B8', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0, marginLeft: 8 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ textAlign: 'center', fontSize: 11, color: '#9AA8B8', margin: '12px 0 10px' }}>— o escribe / pega el texto directamente —</div>
              <textarea
                value={importText} onChange={e => setImportText(e.target.value)}
                placeholder={'Escribe o pega aquí cualquier información:\n• Itinerario de vuelo (Sabre, PNR, texto de correo)\n• Detalles de hotel, crucero, tour o traslado\n• Precios y tarifas\n• Datos del pasaporte\n\nLa IA lo lee y rellena la cotización sola.'}
                style={{ width: '100%', height: 150, border: '1.5px solid #BFD3E6', borderRadius: 10, padding: '10px 12px', fontSize: 12, fontFamily: 'inherit', color: '#15293F', resize: 'vertical', outline: 'none', background: '#F7FBFD', boxSizing: 'border-box' }}
              />
              {importMsg && <div style={{ fontSize: 12, color: '#16A99C', fontWeight: 600, marginTop: 12 }}>⏳ {importMsg}</div>}
              {importError && <div style={{ fontSize: 12, color: '#C0504D', fontWeight: 600, marginTop: 12 }}>⚠ {importError}</div>}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #EDF1F5', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowImport(false); setImportBusy(false); setImportFiles([]) }} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontWeight: 700, fontSize: 13, padding: '10px 16px', borderRadius: 9, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={processImport} disabled={importBusy} style={{ border: 'none', background: '#16A99C', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 9, cursor: importBusy ? 'not-allowed' : 'pointer', opacity: importBusy ? .7 : 1 }}>
                {importBusy ? 'Procesando…' : 'Procesar con IA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SAVED QUOTES ──────────────────────────────────────────── */}
      {showDB && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,63,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 860, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.32)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 17, fontWeight: 800, color: '#0F3D7A' }}>Cotizaciones guardadas&nbsp;<span style={{ color: '#9AA8B8', fontWeight: 600 }}>({savedQuotes.length})</span></div>
              <button onClick={() => setShowDB(false)} style={{ border: 'none', background: 'none', fontSize: 22, color: '#9AA8B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '14px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid #EDF1F5' }}>
              <input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Buscar por cliente o número…" style={{ flex: 1, minWidth: 180, border: '1px solid #D8E0E8', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#15293F', outline: 'none', fontFamily: 'Manrope, sans-serif' }} />
              <select value={filterSeller} onChange={e => setFilterSeller(parseInt(e.target.value))} style={{ border: '1px solid #D8E0E8', borderRadius: 8, padding: 8, fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
                <option value="-1">Todas las vendedores</option>
                {SELLERS.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ border: '1px solid #D8E0E8', borderRadius: 8, padding: 8, fontSize: 13, color: '#15293F', background: '#fff', outline: 'none' }}>
                <option value="all">Todos los estados</option>
                <option>Pendiente</option><option>Enviada</option><option>Aceptada</option>
              </select>
            </div>
            <div style={{ overflowY: 'auto', padding: '16px 24px' }}>
              {savedView.map(r => (
                <div key={r.id} style={{ border: '1px solid #E6ECF2', borderRadius: 11, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 800, color: '#0F3D7A', fontSize: 14 }}>{r.number}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: stcColor[r.status] || '#5B7186', padding: '2px 9px', borderRadius: 20 }}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15293F', marginTop: 4 }}>{r.client || '—'}</div>
                    <div style={{ fontSize: 12, color: '#7A8AA0', marginTop: 2 }}>
                      {(SELLERS[r.sellerIndex] || SELLERS[0]).name} · {new Date(r.savedAt).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })} · {r.products} · {money(r.total, quote.currency)}
                    </div>
                  </div>
                  <select value={r.status} onChange={e => setSavedStatus(r.id, e.target.value)} style={{ border: '1px solid #D8E0E8', borderRadius: 8, padding: 6, fontSize: 12, color: '#15293F', background: '#fff', outline: 'none' }}>
                    <option>Pendiente</option><option>Enviada</option><option>Aceptada</option>
                  </select>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openSaved(r.id)} style={{ border: 'none', background: '#16A99C', color: '#fff', fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>✏ Editar</button>
                    <button onClick={() => downloadSavedPDF(r.id)} disabled={pdfBusy} style={{ border: '1px solid #0F3D7A', background: '#fff', color: '#0F3D7A', fontWeight: 700, fontSize: 12, padding: '8px 11px', borderRadius: 8, cursor: pdfBusy ? 'not-allowed' : 'pointer', opacity: pdfBusy ? .6 : 1 }}>PDF</button>
                    <button onClick={() => duplicateSaved(r.id)} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontWeight: 700, fontSize: 12, padding: '8px 11px', borderRadius: 8, cursor: 'pointer' }}>Duplicar</button>
                    <button onClick={() => askDelete(`¿Eliminar la cotización ${r.number}? Esta acción no se puede deshacer.`, () => deleteSaved(r.id))} style={{ border: '1px solid #F0CFCF', background: '#fff', color: '#C0504D', fontWeight: 700, fontSize: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {savedView.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9AA8B8', fontSize: 13, padding: '40px 0' }}>No hay cotizaciones que coincidan. Usa <b>Guardar</b> para agregar la actual.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CLIENTS CRM ───────────────────────────────────────────── */}
      {showClients && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,63,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 720, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.32)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EDF1F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 17, fontWeight: 800, color: '#0F3D7A' }}>Clientes&nbsp;<span style={{ color: '#9AA8B8', fontWeight: 600 }}>({clients.length})</span></div>
              <button onClick={() => setShowClients(false)} style={{ border: 'none', background: 'none', fontSize: 22, color: '#9AA8B8', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '18px 24px' }}>
              {/* Client form */}
              <div style={{ border: '1px solid #E6ECF2', borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 13, fontWeight: 800, color: '#0F3D7A', marginBottom: 12 }}>Ficha del cliente</div>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ flexShrink: 0, width: 118 }}>
                    {clientForm.photo && <img src={clientForm.photo} alt="Pasaporte" style={{ width: 118, height: 150, objectFit: 'cover', borderRadius: 8, border: '1px solid #E6ECF2', display: 'block' }} />}
                    <label style={{ display: 'block', border: '1.5px dashed #BFD3E6', borderRadius: 8, padding: '11px 6px', textAlign: 'center', cursor: 'pointer', background: '#F7FBFD', marginTop: 8, fontSize: 11, color: '#0F3D7A', fontWeight: 700 }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                        const f = e.target.files?.[0]
                        if (!f) return
                        const reader = new FileReader()
                        reader.onload = ev => setClientForm(cf => ({ ...cf, photo: ev.target?.result as string || '' }))
                        reader.readAsDataURL(f)
                      }} />
                      📎 Foto de pasaporte
                    </label>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 9, alignContent: 'start' }}>
                    {/* Name input with client search dropdown */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={clientForm.name}
                          onChange={e => { setClientForm(cf => ({ ...cf, name: e.target.value })); setClientFormDropdownOpen(true) }}
                          onFocus={() => setClientFormDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setClientFormDropdownOpen(false), 160)}
                          placeholder="Nombre completo"
                          style={{ ...inputSt, flex: 1 }}
                        />
                        <button
                          onMouseDown={e => { e.preventDefault(); setClientFormDropdownOpen(o => !o) }}
                          style={{ border: '1px solid #D8E0E8', background: '#F4F7FA', borderRadius: 8, padding: '0 10px', fontSize: 11, color: '#5B7186', cursor: 'pointer', flexShrink: 0 }}
                          title="Ver clientes guardados"
                        >▼</button>
                      </div>
                      {clientFormDropdownOpen && (() => {
                        const q = (clientForm.name || '').toLowerCase().trim()
                        const matches = clients.filter(c =>
                          !q ||
                          (c.name || '').toLowerCase().includes(q) ||
                          (c.phone || '').includes(q) ||
                          (c.email || '').toLowerCase().includes(q)
                        ).slice(0, 8)
                        if (!matches.length) return null
                        return (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #D8E0E8', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 60, maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
                            {matches.map(c => (
                              <div
                                key={c.id}
                                onMouseDown={() => { setClientForm({ id: c.id, name: c.name || '', phone: c.phone || '', email: c.email || '', passport: c.passport || '', photo: c.photo || '', notes: c.notes || '' }); setClientFormDropdownOpen(false) }}
                                style={{ padding: '9px 13px', cursor: 'pointer', borderBottom: '1px solid #F0F4F8' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                              >
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>{c.name}</div>
                                {(c.phone || c.email) && (
                                  <div style={{ fontSize: 11, color: '#8896A6', marginTop: 1 }}>
                                    {[c.phone, c.email].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                      <input value={clientForm.phone} onChange={e => setClientForm(cf => ({ ...cf, phone: e.target.value }))} placeholder="Teléfono / WhatsApp (+507…)" style={inputSt} />
                      <input value={clientForm.email} onChange={e => setClientForm(cf => ({ ...cf, email: e.target.value }))} placeholder="Email" style={inputSt} />
                    </div>
                    <input value={clientForm.passport} onChange={e => setClientForm(cf => ({ ...cf, passport: e.target.value }))} placeholder="N.º de pasaporte" style={inputSt} />
                    <textarea value={clientForm.notes} onChange={e => setClientForm(cf => ({ ...cf, notes: e.target.value }))} placeholder="Notas (preferencias, milla, etc.)" style={{ ...inputSt, height: 54, resize: 'vertical' }} />
                  </div>
                </div>
                {clientError && <div style={{ fontSize: 12, color: '#C0504D', fontWeight: 600, marginTop: 10 }}>⚠ {clientError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  {clientForm.id && (
                    <button onClick={() => { setClientForm(emptyClientForm()); setClientError('') }} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontWeight: 700, fontSize: 13, padding: '10px 16px', borderRadius: 9, cursor: 'pointer', marginRight: 8 }}>Cancelar</button>
                  )}
                  <button onClick={saveClient} style={{ border: 'none', background: '#16A99C', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>
                    {clientForm.id ? 'Actualizar cliente' : 'Guardar cliente'}
                  </button>
                </div>
              </div>

              <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente por nombre, teléfono, email o pasaporte…" style={{ ...inputSt, marginBottom: 12 }} />

              {clientsView.map(c => (
                <div key={c.id} style={{ border: '1px solid #E6ECF2', borderRadius: 11, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 13 }}>
                  {c.photo
                    ? <img src={c.photo} alt={c.name} style={{ width: 46, height: 58, objectFit: 'cover', borderRadius: 7, border: '1px solid #E6ECF2', flexShrink: 0 }} />
                    : <div style={{ width: 46, height: 58, borderRadius: 7, background: '#EAF6FB', color: '#134A99', fontFamily: 'Archivo, sans-serif', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(c.name[0] || '?').toUpperCase()}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15293F' }}>{c.name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#7A8AA0', marginTop: 2 }}>{c.phone} · {c.email}</div>
                    <div style={{ fontSize: 11, color: '#9AA8B8', marginTop: 1 }}>Pasaporte: {c.passport || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => useClient(c.id)} style={{ border: 'none', background: '#0F3D7A', color: '#fff', fontWeight: 700, fontSize: 12, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Usar</button>
                    <button onClick={() => setClientForm({ id: c.id, name: c.name, phone: c.phone, email: c.email, passport: c.passport, photo: c.photo, notes: c.notes })} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontWeight: 700, fontSize: 12, padding: '8px 11px', borderRadius: 8, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => askDelete(`¿Eliminar el cliente "${c.name}"? Esta acción no se puede deshacer.`, () => deleteClient(c.id))} style={{ border: '1px solid #F0CFCF', background: '#fff', color: '#C0504D', fontWeight: 700, fontSize: 12, padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}>×</button>
                  </div>
                </div>
              ))}
              {clientsView.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9AA8B8', fontSize: 13, padding: '28px 0' }}>Aún no hay clientes guardados. Crea uno con la ficha de arriba.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM CLIENT SAVE ──────────────────────────────────────────── */}
      {confirmClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,63,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 440, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.32)', overflow: 'hidden' }}>
            {/* Existing client banner */}
            {confirmClient.exists && (
              <div style={{ background: '#E8F7F5', borderBottom: '1px solid #C0E8E4', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15 }}>✅</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0E7E75', letterSpacing: '.04em' }}>CLIENTE EXISTENTE EN TU CRM</div>
                  <div style={{ fontSize: 11, color: '#5B7186' }}>Sus datos guardados ya están cargados — edítalos si hay cambios</div>
                </div>
              </div>
            )}
            <div style={{ padding: '20px 24px 8px' }}>
              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 17, fontWeight: 800, color: '#0F3D7A' }}>
                {confirmClient.exists ? 'Confirmar datos del cliente' : '¿Guardar este cliente en tu archivo?'}
              </div>
              <div style={{ fontSize: 13, color: '#5B7186', marginTop: 5, lineHeight: 1.5 }}>
                {confirmClient.exists ? 'Revisa y edita los datos antes de actualizar.' : 'La IA detectó estos datos. Edítalos si necesitas antes de guardar.'}
              </div>
            </div>
            {/* Editable fields */}
            <div style={{ margin: '10px 24px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Nombre with client search dropdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#7A8AA0', fontWeight: 600 }}>Nombre</span>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={confirmClient.name}
                      placeholder="APELLIDO / NOMBRE"
                      onChange={e => { setConfirmClient(prev => prev ? { ...prev, name: e.target.value } : prev); setConfirmDropdownOpen(true) }}
                      onFocus={() => setConfirmDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setConfirmDropdownOpen(false), 160)}
                      style={{ border: '1px solid #D8E0E8', borderRadius: 7, padding: '7px 10px', fontSize: 13, color: '#15293F', outline: 'none', flex: 1, boxSizing: 'border-box' as const }}
                    />
                    <button
                      onMouseDown={e => { e.preventDefault(); setConfirmDropdownOpen(o => !o) }}
                      style={{ border: '1px solid #D8E0E8', background: '#F4F7FA', borderRadius: 7, padding: '0 10px', fontSize: 11, color: '#5B7186', cursor: 'pointer', flexShrink: 0 }}
                      title="Ver clientes guardados"
                    >▼</button>
                  </div>
                  {confirmDropdownOpen && (() => {
                    const q = (confirmClient.name || '').toLowerCase().trim()
                    const matches = clients.filter(c =>
                      !q ||
                      (c.name || '').toLowerCase().includes(q) ||
                      (c.phone || '').includes(q) ||
                      (c.email || '').toLowerCase().includes(q)
                    ).slice(0, 8)
                    if (!matches.length) return null
                    return (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #D8E0E8', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.14)', zIndex: 80, maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                        {matches.map(c => (
                          <div
                            key={c.id}
                            onMouseDown={() => {
                              setConfirmClient(prev => prev ? { ...prev, name: c.name || '', phone: c.phone || '', email: c.email || '', passport: c.passport || '', exists: true, existingId: c.id } : prev)
                              setConfirmDropdownOpen(false)
                            }}
                            style={{ padding: '9px 13px', cursor: 'pointer', borderBottom: '1px solid #F0F4F8' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F0F7FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>{c.name}</div>
                            {(c.phone || c.email) && (
                              <div style={{ fontSize: 11, color: '#8896A6', marginTop: 1 }}>{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
              {/* Teléfono and Email */}
              {([
                ['Teléfono', 'phone', '+507 6000-0000'],
                ['Email', 'email', 'correo@ejemplo.com'],
              ] as [string, keyof typeof confirmClient, string][]).map(([label, field, placeholder]) => (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#7A8AA0', fontWeight: 600 }}>{label}</span>
                  <input
                    value={(confirmClient[field] as string) || ''}
                    placeholder={placeholder}
                    onChange={e => setConfirmClient(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                    style={{ border: '1px solid #D8E0E8', borderRadius: 7, padding: '7px 10px', fontSize: 13, color: '#15293F', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmClient(null)} style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={acceptConfirmClient} style={{ border: 'none', background: '#16A99C', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}>
                {confirmClient.exists ? 'Actualizar cliente' : 'Guardar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ───────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0F3D7A', color: '#fff', padding: '11px 22px', borderRadius: 30, fontSize: 13, fontWeight: 600, zIndex: 60, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
          ✓ {toast}
        </div>
      )}

      {/* ── MODAL: CONFIRM DELETE ───────────────────────────────────────── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,41,63,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 380, maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.32)', padding: '28px 28px 22px' }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 18, fontWeight: 800, color: '#15293F', marginBottom: 10 }}>¿Estás segura?</div>
            <div style={{ fontSize: 14, color: '#5B7186', lineHeight: 1.6, marginBottom: 24 }}>{confirmDelete.msg}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ border: '1px solid #D8E0E8', background: '#fff', color: '#15293F', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={() => { confirmDelete.onConfirm(); setConfirmDelete(null) }}
                style={{ border: 'none', background: '#C0504D', color: '#fff', fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 9, cursor: 'pointer' }}
              >Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print styles ────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          #toolbar, #editor { display: none !important; }
          #docscroll { overflow: visible !important; padding: 0 !important; background: #fff !important; display: block !important; }
          #doc { width: 100% !important; box-shadow: none !important; border-radius: 0 !important; }
          html, body { height: auto !important; }
          @page { margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
