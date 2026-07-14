'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { QuoteDoc, FlightItem, HotelItem, CruiseItem, TourItem, TransferItem, Segment } from '@/lib/cotizador/types'
import { calcFlightDuration } from '@/lib/cotizador/flightDuration'

const SELLERS = [
  { name: 'Sandra Missrie', phone: '+507 6070-8569', email: 'Ceviaja@hotmail.com', initials: 'SM' },
  { name: 'Manuel Finol', phone: '+507 6093-7798', email: 'Manuel@ceviaja.com', initials: 'MF' },
  { name: 'Esther Gonzalez', phone: '+507 6151-5700', email: 'Esther@ceviaja.com', initials: 'EG' },
  { name: 'Xenia de De Bello', phone: '+507 6202-4708', email: 'Xenia@ceviaja.com', initials: 'XB' },
  { name: 'Nanci Torres', phone: '+507 6151-5900', email: 'Nanci@ceviaja.com', initials: 'NT' },
  { name: 'Alejandra Delgado', phone: '+507 6140-8514', email: 'Adelgado@ceviaja.com', initials: 'AD' },
]

function money(n: number, cur: string) {
  return cur + ' ' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseDurMin(s: string): number {
  const m = s?.match(/(\d+)h(?:\s*(\d+)m)?/)
  if (!m) return 0
  return parseInt(m[1]) * 60 + parseInt(m[2] || '0')
}
function fmtMin(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h + 'h' + (m ? ' ' + m + 'm' : '')
}
function totalFlightDuration(segs: Segment[]): string | null {
  let total = 0
  for (const seg of segs) {
    if (seg.duration) total += parseDurMin(seg.duration)
    if (seg.connectionAfter) {
      const after = seg.connectionAfter.split('·').pop()?.trim() || ''
      const conn = parseDurMin(after)
      if (conn > 0) total += conn
    }
  }
  return total > 0 ? fmtMin(total) : null
}

export default function VerCotizacion() {
  const { id } = useParams<{ id: string }>()
  const [quote, setQuote] = useState<QuoteDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/cotizador/quote/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setNotFound(true)
        else setQuote(d.data as QuoteDoc)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e7e5df', fontFamily: 'Manrope, sans-serif', fontSize: 15, color: '#5B7186' }}>
      Cargando cotización…
    </div>
  )
  if (notFound || !quote) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e7e5df', fontFamily: 'Manrope, sans-serif', fontSize: 15, color: '#C0504D' }}>
      Cotización no encontrada.
    </div>
  )

  const seller = SELLERS[quote.sellerIndex] || SELLERS[0]
  const paxCount = (quote.pax || []).length
  const adultoCount = (quote.pax || []).filter(p => p.type === 'Adulto').length
  const ninoCount   = (quote.pax || []).filter(p => p.type === 'Niño').length
  const jubCount    = (quote.pax || []).filter(p => p.type === 'Jubilado').length
  const total = adultoCount * (quote.priceAdulto || 0) + ninoCount * (quote.priceNino || 0) + jubCount * (quote.priceJubilado || 0)
  const perPax = paxCount > 0 ? total / paxCount : total
  const totalFmt = money(total, quote.currency)
  const perPaxFmt = money(perPax, quote.currency)

  const paxSummary = (() => {
    const c: Record<string, number> = {}
    ;(quote.pax || []).forEach(p => { c[p.type] = (c[p.type] || 0) + 1 })
    return Object.entries(c).map(([t, n]) => `${n} ${t.toLowerCase()}${n > 1 && t === 'Adulto' ? 's' : ''}`).join(', ')
  })()
  const cabinSummary = [...new Set((quote.pax || []).map(p => p.cabin))].join(' / ')
  const PAX_CODE: Record<string, string> = { Adulto: 'ADT', Niño: 'CHD', Jubilado: 'SRC', Infante: 'INF' }

  return (
    <div style={{ minHeight: '100vh', background: '#e7e5df', padding: '32px 16px', fontFamily: 'Manrope, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', boxShadow: '0 4px 24px rgba(15,61,122,.10)', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ padding: '26px 38px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #16A99C' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="CE Viaja" style={{ height: 44, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.2em', color: '#16A99C' }}>COTIZACIÓN DE VIAJE</div>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 21, fontWeight: 800, color: '#0F3D7A' }}>N.º {quote.number}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Main content */}
          <div style={{ flex: 1, minWidth: 300, padding: '28px 32px', borderRight: '1px solid #EDF1F5' }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 23, fontWeight: 800, color: '#0F3D7A' }}>{quote.client}</div>
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

            {(quote.items || []).map((item, idx) => (
              <div key={idx} style={{ marginBottom: 20 }}>

                {item.type === 'flight' && (() => {
                  const fi = item as FlightItem
                  const first = fi.segments[0], last = fi.segments[fi.segments.length - 1]
                  const totalDur = fi.segments.length > 1
                    ? totalFlightDuration(fi.segments)
                    : (first && last ? calcFlightDuration(first.from, first.dep, last.to, last.arr, fi.date, last.plus) : null) ?? totalFlightDuration(fi.segments)
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
                        <div style={{ background: '#0F3D7A', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6 }}>{(fi.dir || '').toUpperCase()} · {fi.date}</div>
                        {totalDur && <div style={{ fontSize: 12, color: '#5B7186', fontWeight: 700 }}>⏱ {totalDur} en total</div>}
                      </div>
                      {fi.segments.map((seg, sidx) => (
                        <div key={sidx}>
                          <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                            <div style={{ background: '#F6F9FB', padding: '9px 14px', fontSize: 12, fontWeight: 700, color: '#15293F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{seg.airline} · {seg.flightNo}</span>
                              <span style={{ color: '#16A99C' }}>{seg.alliance}</span>
                            </div>
                            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 16px' }}>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>SALE · {seg.from} {seg.fromCity}</div><div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 18, fontWeight: 700, color: '#15293F' }}>{seg.dep}</div></div>
                              <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>LLEGA · {seg.to} {seg.toCity}</div><div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 18, fontWeight: 700, color: '#15293F' }}>{seg.arr} <span style={{ fontSize: 11, color: '#16A99C' }}>{seg.plus}</span></div></div>
                              <div style={{ fontSize: 12, color: '#5B7186' }}>Duración {seg.duration}</div>
                              <div style={{ fontSize: 12, color: '#5B7186' }}>{seg.aircraft} · {seg.cabin}</div>
                            </div>
                          </div>
                          {seg.connectionAfter && <div style={{ fontSize: 12, color: '#B08400', background: '#FBF6E9', borderRadius: 6, padding: '7px 14px', marginBottom: 10 }}>⏱ {seg.connectionAfter}</div>}
                        </div>
                      ))}
                      <div style={{ fontSize: 12, color: '#5B7186', paddingTop: 2 }}>🧳 {fi.baggage}</div>
                    </>
                  )
                })()}

                {item.type === 'hotel' && (() => {
                  const hi = item as HotelItem
                  return (
                    <>
                      <div style={{ marginBottom: 13 }}><div style={{ background: '#16A99C', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6, display: 'inline-block' }}>HOTEL · {hi.name}</div></div>
                      <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                          <div style={{ gridColumn: 'span 2' }}><div style={{ fontSize: 11, color: '#9AA8B8' }}>UBICACIÓN</div><div style={{ fontSize: 14, fontWeight: 600, color: '#15293F' }}>{hi.location}</div></div>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>CHECK-IN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.checkIn}</div></div>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>CHECK-OUT</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.checkOut}</div></div>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>HABITACIÓN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.roomType}</div></div>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>RÉGIMEN · {hi.nights} noches</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{hi.board}</div></div>
                        </div>
                      </div>
                    </>
                  )
                })()}

                {item.type === 'cruise' && (() => {
                  const ci = item as CruiseItem
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
                        <div style={{ background: '#134A99', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6 }}>CRUCERO · {ci.line}</div>
                        {ci.nights && <div style={{ fontSize: 12, color: '#5B7186', fontWeight: 700 }}>🚢 {ci.nights} noches</div>}
                      </div>
                      <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #EDF1F5' }}><div style={{ fontSize: 11, color: '#9AA8B8', marginBottom: 3 }}>BARCO · ITINERARIO</div><div style={{ fontSize: 15, fontWeight: 700, color: '#15293F' }}>{ci.ship}</div><div style={{ fontSize: 13, color: '#5B7186', marginTop: 2 }}>{ci.route}</div></div>
                        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 14px', borderBottom: '1px solid #EDF1F5' }}>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>ZARPA</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ci.depart}</div></div>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>DURACIÓN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ci.nights} noches</div></div>
                          <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>EMBARQUE</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ci.boardingTime || '—'}</div></div>
                        </div>
                        <div style={{ padding: '10px 14px', borderBottom: ci.promotion ? '1px solid #EDF1F5' : undefined }}>
                          <div style={{ fontSize: 11, color: '#9AA8B8', marginBottom: 4 }}>CAMAROTE</div>
                          {ci.cabinLabel && <div style={{ fontSize: 15, fontWeight: 700, color: '#0F3D7A', marginBottom: 4 }}>{ci.cabinLabel}</div>}
                          {ci.cabin && <div style={{ fontSize: 10, color: '#9AA8B8' }}>{ci.cabin}</div>}
                        </div>
                        {ci.promotion && <div style={{ padding: '8px 14px', background: '#F0FBF9', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 10, color: '#16A99C', fontWeight: 700, letterSpacing: '.06em' }}>PROMOCIÓN</span><span style={{ fontSize: 12, fontWeight: 700, color: '#0E7E75' }}>{ci.promotion}</span></div>}
                      </div>
                      {ci.ports && ci.ports.length > 0 && (
                        <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, overflow: 'hidden' }}>
                          <div style={{ padding: '8px 14px', background: '#134A99' }}><div style={{ fontSize: 11, color: 'rgba(255,255,255,.85)', fontWeight: 700, letterSpacing: '.08em' }}>ITINERARIO DE PUERTOS</div></div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead><tr style={{ background: '#F6F9FB' }}><th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: '#9AA8B8', fontWeight: 700 }}>FECHA</th><th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: '#9AA8B8', fontWeight: 700 }}>PUERTO</th><th style={{ padding: '7px 12px', textAlign: 'center', fontSize: 10, color: '#9AA8B8', fontWeight: 700 }}>LLEGADA</th><th style={{ padding: '7px 12px', textAlign: 'center', fontSize: 10, color: '#9AA8B8', fontWeight: 700 }}>SALIDA</th></tr></thead>
                            <tbody>{ci.ports.map((p, pi) => (<tr key={pi} style={{ borderTop: '1px solid #EDF1F5', background: pi % 2 === 0 ? '#fff' : '#FAFBFD' }}><td style={{ padding: '9px 12px', color: '#5B7186', fontWeight: 600 }}>{p.date}</td><td style={{ padding: '9px 12px', color: '#15293F', fontWeight: 600 }}>{p.port}</td><td style={{ padding: '9px 12px', textAlign: 'center', color: '#15293F', fontFamily: 'Archivo, sans-serif', fontWeight: 700 }}>{p.arr || '—'}</td><td style={{ padding: '9px 12px', textAlign: 'center', color: '#15293F', fontFamily: 'Archivo, sans-serif', fontWeight: 700 }}>{p.dep || '—'}</td></tr>))}</tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )
                })()}

                {item.type === 'tour' && (() => {
                  const ti = item as TourItem
                  return (
                    <>
                      <div style={{ marginBottom: 13 }}><div style={{ background: '#16A99C', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6, display: 'inline-block' }}>TOUR · {ti.name}</div></div>
                      <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 16px' }}>
                        <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>LUGAR</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ti.location}</div></div>
                        <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>FECHA · DURACIÓN</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ti.date} · {ti.duration}</div></div>
                        <div style={{ gridColumn: 'span 2' }}><div style={{ fontSize: 11, color: '#9AA8B8' }}>INCLUYE</div><div style={{ fontSize: 13, fontWeight: 600, color: '#15293F' }}>{ti.includes}</div></div>
                      </div>
                    </>
                  )
                })()}

                {item.type === 'transfer' && (() => {
                  const tr = item as TransferItem
                  return (
                    <>
                      <div style={{ marginBottom: 13 }}><div style={{ background: '#0F3D7A', color: '#fff', fontFamily: 'Archivo, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', padding: '7px 14px', borderRadius: 6, display: 'inline-block' }}>TRASLADO {tr.mode}</div></div>
                      <div style={{ border: '1px solid #E6EDF3', borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div><div style={{ fontSize: 11, color: '#9AA8B8' }}>RECORRIDO</div><div style={{ fontSize: 14, fontWeight: 600, color: '#15293F' }}>{tr.from} → {tr.to}</div></div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#9AA8B8' }}>{tr.date}</div><div style={{ fontSize: 13, fontWeight: 600, color: '#16A99C' }}>{tr.vehicle}</div></div>
                      </div>
                    </>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ width: 220, flexShrink: 0, background: '#fff', padding: '28px 20px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800 }}>Resumen</div>
            <div style={{ marginTop: 14, fontSize: 13, color: '#15293F', lineHeight: 1.95 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Pasajeros</span><span style={{ fontWeight: 700 }}>{paxSummary}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Clase</span><span style={{ fontWeight: 700 }}>{cabinSummary}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Vigencia</span><span style={{ fontWeight: 700 }}>{quote.validez}</span></div>
            </div>

            {(quote.priceAdulto > 0 || quote.priceNino > 0 || quote.priceJubilado > 0) && (
              <>
                <div style={{ height: 1, background: '#EDF1F5', margin: '18px 0' }} />
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800, marginBottom: 10 }}>Precio por pasajero</div>
                <div style={{ fontSize: 13, color: '#15293F', lineHeight: 2 }}>
                  {quote.priceAdulto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Adulto</span><span style={{ fontWeight: 700 }}>{money(quote.priceAdulto, quote.currency)}</span></div>}
                  {quote.priceNino > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Niño</span><span style={{ fontWeight: 700 }}>{money(quote.priceNino, quote.currency)}</span></div>}
                  {quote.priceJubilado > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#5B7186' }}>Jubilado</span><span style={{ fontWeight: 700 }}>{money(quote.priceJubilado, quote.currency)}</span></div>}
                </div>
              </>
            )}

            <div style={{ height: 1, background: '#EDF1F5', margin: '18px 0' }} />
            <div style={{ background: '#0F3D7A', color: '#fff', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, opacity: .8, letterSpacing: '.04em', marginBottom: 2 }}>TOTAL · {quote.currency}</div>
              <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 24, fontWeight: 800, color: '#9EE7DE', marginBottom: 10 }}>{totalFmt}</div>
              <div style={{ height: 1, background: 'rgba(255,255,255,.15)', marginBottom: 10 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, opacity: .8, letterSpacing: '.04em' }}>POR PASAJERO</span>
                <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: 15, fontWeight: 800 }}>{perPaxFmt}</span>
              </div>
            </div>

            <div style={{ height: 1, background: '#EDF1F5', margin: '20px 0' }} />
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800 }}>Tu asesora</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#134A99', color: '#fff', fontFamily: 'Archivo, sans-serif', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{seller.initials}</div>
              <div><div style={{ fontFamily: 'Archivo, sans-serif', fontSize: 14, fontWeight: 700, color: '#15293F' }}>{seller.name}</div><div style={{ fontSize: 12, color: '#16A99C', fontWeight: 700 }}>{seller.phone}</div></div>
            </div>
            <div style={{ fontSize: 12, color: '#5B7186', marginTop: 9, wordBreak: 'break-all' }}>{seller.email}</div>

            <div style={{ height: 1, background: '#EDF1F5', margin: '20px 0' }} />
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: '#0F3D7A', fontWeight: 800 }}>Cuentas para pagos</div>
            <div style={{ background: '#EAF6FB', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
              <div style={{ fontSize: 10, color: '#7A8AA0', textTransform: 'uppercase' }}>Nombre de la cuenta</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>C VIAJA, S.A.</div>
              <div style={{ fontSize: 10, color: '#7A8AA0', textTransform: 'uppercase', marginTop: 6 }}>Tipo de cuenta</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F' }}>Corriente</div>
              <div style={{ height: 1, background: '#C7E2EF', margin: '11px 0' }} />
              <div style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F3D7A' }}>Banco General</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F', fontFamily: 'Archivo, sans-serif' }}>03-02-01-126429-0</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F3D7A' }}>Global Bank</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#15293F', fontFamily: 'Archivo, sans-serif' }}>21-101-22397-0</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 32px', background: '#0F3D7A', color: '#9FC0E8', fontSize: 11, textAlign: 'center', letterSpacing: '.04em' }}>
          CE Viaja · Asesoría experta en cada viaje · Cotización válida {quote.validez}, sujeta a disponibilidad y cambios de tarifa
        </div>
      </div>

      {/* Download PDF button */}
      <div style={{ maxWidth: 800, margin: '16px auto 0', textAlign: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{ border: 'none', background: '#0F3D7A', color: '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, padding: '12px 28px', borderRadius: 10, cursor: 'pointer' }}
        >Guardar como PDF</button>
      </div>

      <style>{`
        @media print {
          button { display: none !important; }
          body { background: #fff !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 10mm; }
        }
      `}</style>
    </div>
  )
}
