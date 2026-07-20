export interface Seller {
  name: string
  phone: string
  email: string
  initials: string
}

export interface Segment {
  airline: string
  flightNo: string
  alliance: string
  from: string
  fromCity: string
  dep: string
  to: string
  toCity: string
  arr: string
  plus: string
  duration: string
  aircraft: string
  cabin: string
  connectionAfter: string
}

export interface FlightItem {
  type: 'flight'
  dir: string
  date: string
  price: number
  baggage: string
  segments: Segment[]
}

export interface HotelItem {
  type: 'hotel'
  name: string
  stars: number
  location: string
  address: string
  checkIn: string
  checkOut: string
  nights: string
  roomType: string
  board: string
  cancellation: string
  price: number
  photos?: string[]
}

export interface CruisePort {
  date: string
  port: string
  arr: string
  dep: string
}

export interface CruiseItem {
  type: 'cruise'
  line: string
  ship: string
  route: string
  depart: string
  nights: string
  cabin: string
  cabinLabel: string
  boardingTime: string
  ports: CruisePort[]
  promotion: string
  price: number
}

export interface TourItem {
  type: 'tour'
  name: string
  location: string
  date: string
  duration: string
  includes: string
  price: number
}

export interface TransferItem {
  type: 'transfer'
  from: string
  to: string
  date: string
  vehicle: string
  mode: string
  price: number
}

export interface CarItem {
  type: 'car'
  company: string
  category: string
  model: string
  pickupLocation: string
  pickupCode: string
  pickupAddress: string
  pickupDate: string
  pickupTime: string
  dropoffLocation: string
  returnCode: string
  returnAddress: string
  returnDate: string
  returnTime: string
  days: string
  passengers: string
  bags: string
  doors: string
  ac: string
  transmission: string
  protection: string
  promotion: string
  price: number
}

export interface PackageItem {
  type: 'package'
  name: string
  destination: string
  startDate: string
  endDate: string
  duration: string
  includes: string
  description: string
  promotion: string
  price: number
}

export interface InsuranceItem {
  type: 'insurance'
  company: string
  plan: string
  destination: string
  startDate: string
  endDate: string
  days: string
  coverage: string
  price: number
}

export type QuoteItem = FlightItem | HotelItem | CruiseItem | TourItem | TransferItem | CarItem | InsuranceItem | PackageItem

export interface Pax {
  name: string
  type: string
  cabin: string
}

export interface QuoteDoc {
  number: string
  date: string
  validez: string
  client: string
  clientPhone: string
  clientEmail: string
  clientPassport: string
  clientId: string
  cabin: string
  pax: Pax[]
  currency: string
  sellerIndex: number
  taxes: number
  priceAdulto: number
  priceNino: number
  priceJubilado: number
  priceInfante: number
  items: QuoteItem[]
  comments?: string
  pdfTitle?: string
}

export interface SavedQuote {
  id: string
  number: string
  client: string
  sellerIndex: number
  savedAt: string
  status: 'Pendiente' | 'Enviada' | 'Aceptada'
  total: number
  products: string
  quote: QuoteDoc
}

export interface CRMClient {
  id: string
  name: string
  phone: string
  email: string
  passport: string
  photo: string
  notes: string
  createdAt: string
}

export interface ClientForm {
  id?: string
  name: string
  phone: string
  email: string
  passport: string
  photo: string
  notes: string
}
