// IATA → IANA timezone. Covers the main routes a Panama travel agency books.
const AIRPORT_TZ: Record<string, string> = {
  // Panama
  PTY: 'America/Panama', DAV: 'America/Panama',

  // USA East
  MIA: 'America/New_York', FLL: 'America/New_York', PBI: 'America/New_York',
  MCO: 'America/New_York', TPA: 'America/New_York', RSW: 'America/New_York',
  JFK: 'America/New_York', EWR: 'America/New_York', LGA: 'America/New_York',
  BOS: 'America/New_York', BUF: 'America/New_York', SYR: 'America/New_York',
  IAD: 'America/New_York', DCA: 'America/New_York', BWI: 'America/New_York',
  PHL: 'America/New_York', CLT: 'America/New_York', RDU: 'America/New_York',
  ATL: 'America/New_York', SAV: 'America/New_York', JAX: 'America/New_York',
  ORF: 'America/New_York', RIC: 'America/New_York', BDL: 'America/New_York',
  PWM: 'America/New_York', BGR: 'America/New_York',
  // USA Central
  ORD: 'America/Chicago', MDW: 'America/Chicago',
  DFW: 'America/Chicago', DAL: 'America/Chicago',
  IAH: 'America/Chicago', HOU: 'America/Chicago',
  SAT: 'America/Chicago', AUS: 'America/Chicago',
  MSP: 'America/Chicago', STL: 'America/Chicago', MCI: 'America/Chicago',
  MSY: 'America/Chicago', MEM: 'America/Chicago', OMA: 'America/Chicago',
  OKC: 'America/Chicago', TUL: 'America/Chicago', BNA: 'America/Chicago',
  MKE: 'America/Chicago', IND: 'America/Indiana/Indianapolis',
  // USA Mountain
  DEN: 'America/Denver', ABQ: 'America/Denver', SLC: 'America/Denver',
  BOI: 'America/Denver', BIL: 'America/Denver',
  PHX: 'America/Phoenix', TUS: 'America/Phoenix',
  // USA Pacific
  LAX: 'America/Los_Angeles', SAN: 'America/Los_Angeles',
  SFO: 'America/Los_Angeles', OAK: 'America/Los_Angeles', SJC: 'America/Los_Angeles',
  SEA: 'America/Los_Angeles', PDX: 'America/Los_Angeles',
  LAS: 'America/Los_Angeles', SMF: 'America/Los_Angeles', SNA: 'America/Los_Angeles',
  // USA Alaska / Hawaii
  ANC: 'America/Anchorage', FAI: 'America/Anchorage',
  HNL: 'Pacific/Honolulu', OGG: 'Pacific/Honolulu', KOA: 'Pacific/Honolulu',

  // Canada
  YYZ: 'America/Toronto', YUL: 'America/Toronto', YOW: 'America/Toronto',
  YHZ: 'America/Halifax', YYT: 'America/St_Johns',
  YVR: 'America/Vancouver', YYC: 'America/Edmonton', YEG: 'America/Edmonton',
  YWG: 'America/Winnipeg',

  // Mexico
  MEX: 'America/Mexico_City', GDL: 'America/Mexico_City', MTY: 'America/Monterrey',
  CUN: 'America/Cancun', SJD: 'America/Mazatlan', MXL: 'America/Tijuana',
  ACA: 'America/Mexico_City', ZIH: 'America/Mexico_City', PVR: 'America/Mexico_City',
  OAX: 'America/Mexico_City', MID: 'America/Merida',

  // Central America
  SJO: 'America/Costa_Rica', LIR: 'America/Costa_Rica',
  SAL: 'America/El_Salvador',
  GUA: 'America/Guatemala',
  TGU: 'America/Tegucigalpa',
  MGA: 'America/Managua',
  BZE: 'America/Belize',

  // Caribbean
  MBJ: 'America/Jamaica', KIN: 'America/Jamaica',
  SDQ: 'America/Santo_Domingo', PUJ: 'America/Santo_Domingo', STI: 'America/Santo_Domingo',
  SJU: 'America/Puerto_Rico', BQN: 'America/Puerto_Rico',
  HAV: 'America/Havana', VRA: 'America/Havana', HOG: 'America/Havana',
  NAS: 'America/Nassau', FPO: 'America/Nassau', ELH: 'America/Nassau', GHB: 'America/Nassau',
  GCM: 'America/Cayman',
  ANU: 'America/Antigua',
  BGI: 'America/Barbados',
  POS: 'America/Port_of_Spain', TAB: 'America/Port_of_Spain',
  CUR: 'America/Curacao', AUA: 'America/Aruba', BON: 'America/Curacao',
  SXM: 'America/Lower_Princes',
  STT: 'America/St_Thomas', STX: 'America/St_Thomas', SJF: 'America/St_Thomas',
  BDA: 'Atlantic/Bermuda',
  PTP: 'America/Guadeloupe', FDF: 'America/Martinique',

  // Colombia
  BOG: 'America/Bogota', MDE: 'America/Bogota', CTG: 'America/Bogota',
  CLO: 'America/Bogota', BAQ: 'America/Bogota', ADZ: 'America/Bogota',
  PEI: 'America/Bogota', BGA: 'America/Bogota',

  // Venezuela
  CCS: 'America/Caracas', MAR: 'America/Caracas', BLA: 'America/Caracas',

  // Ecuador
  UIO: 'America/Guayaquil', GYE: 'America/Guayaquil',

  // Peru
  LIM: 'America/Lima', CUZ: 'America/Lima',

  // Bolivia
  LPB: 'America/La_Paz', VVI: 'America/La_Paz', CBB: 'America/La_Paz',

  // Paraguay
  ASU: 'America/Asuncion',

  // Chile
  SCL: 'America/Santiago', IQQ: 'America/Santiago', ANF: 'America/Santiago',
  PMC: 'America/Santiago', PUQ: 'America/Punta_Arenas',

  // Argentina
  EZE: 'America/Argentina/Buenos_Aires', AEP: 'America/Argentina/Buenos_Aires',
  COR: 'America/Argentina/Cordoba', MDZ: 'America/Argentina/Mendoza',
  ROS: 'America/Argentina/Buenos_Aires', BRC: 'America/Argentina/Buenos_Aires',

  // Uruguay
  MVD: 'America/Montevideo',

  // Brazil
  GRU: 'America/Sao_Paulo', CGH: 'America/Sao_Paulo', VCP: 'America/Sao_Paulo',
  GIG: 'America/Sao_Paulo', SDU: 'America/Sao_Paulo', BSB: 'America/Sao_Paulo',
  CNF: 'America/Sao_Paulo', SSA: 'America/Bahia', REC: 'America/Recife',
  FOR: 'America/Fortaleza', MAO: 'America/Manaus', BEL: 'America/Belem',
  CWB: 'America/Sao_Paulo', POA: 'America/Sao_Paulo', FLN: 'America/Sao_Paulo',

  // Guyana / Suriname
  GEO: 'America/Guyana', PBM: 'America/Paramaribo',

  // Europe — West
  MAD: 'Europe/Madrid', BCN: 'Europe/Madrid', PMI: 'Europe/Madrid',
  VLC: 'Europe/Madrid', AGP: 'Europe/Madrid', SVQ: 'Europe/Madrid', TFS: 'Atlantic/Canary',
  LHR: 'Europe/London', LGW: 'Europe/London', STN: 'Europe/London',
  LTN: 'Europe/London', MAN: 'Europe/London', EDI: 'Europe/London', BHX: 'Europe/London',
  CDG: 'Europe/Paris', ORY: 'Europe/Paris', NCE: 'Europe/Paris', LYS: 'Europe/Paris',
  AMS: 'Europe/Amsterdam',
  BRU: 'Europe/Brussels',
  LIS: 'Europe/Lisbon', OPO: 'Europe/Lisbon', FAO: 'Europe/Lisbon',
  // Europe — Central
  FRA: 'Europe/Berlin', MUC: 'Europe/Berlin', BER: 'Europe/Berlin',
  DUS: 'Europe/Berlin', HAM: 'Europe/Berlin', STR: 'Europe/Berlin', CGN: 'Europe/Berlin',
  FCO: 'Europe/Rome', MXP: 'Europe/Rome', LIN: 'Europe/Rome',
  VCE: 'Europe/Rome', NAP: 'Europe/Rome', BLQ: 'Europe/Rome',
  ZRH: 'Europe/Zurich', GVA: 'Europe/Zurich', BSL: 'Europe/Zurich',
  VIE: 'Europe/Vienna',
  PRG: 'Europe/Prague',
  BUD: 'Europe/Budapest',
  WAW: 'Europe/Warsaw', KRK: 'Europe/Warsaw',
  // Europe — North
  OSL: 'Europe/Oslo', BGO: 'Europe/Oslo',
  ARN: 'Europe/Stockholm', GOT: 'Europe/Stockholm',
  CPH: 'Europe/Copenhagen', AAL: 'Europe/Copenhagen',
  HEL: 'Europe/Helsinki',
  RIX: 'Europe/Riga', TLL: 'Europe/Tallinn', VNO: 'Europe/Vilnius',
  // Europe — East / Turkey / Russia
  ATH: 'Europe/Athens', SKG: 'Europe/Athens',
  IST: 'Europe/Istanbul', SAW: 'Europe/Istanbul', ADB: 'Europe/Istanbul',
  SVO: 'Europe/Moscow', DME: 'Europe/Moscow', VKO: 'Europe/Moscow', LED: 'Europe/Moscow',
  OTP: 'Europe/Bucharest', SOF: 'Europe/Sofia',

  // Middle East
  DXB: 'Asia/Dubai', AUH: 'Asia/Dubai', SHJ: 'Asia/Dubai',
  DOH: 'Asia/Qatar',
  RUH: 'Asia/Riyadh', JED: 'Asia/Riyadh', MED: 'Asia/Riyadh',
  KWI: 'Asia/Kuwait',
  BAH: 'Asia/Bahrain',
  MCT: 'Asia/Muscat',
  AMM: 'Asia/Amman',
  BEY: 'Asia/Beirut',
  TLV: 'Asia/Jerusalem',

  // Africa
  CAI: 'Africa/Cairo', HRG: 'Africa/Cairo', SSH: 'Africa/Cairo',
  JNB: 'Africa/Johannesburg', CPT: 'Africa/Johannesburg', DUR: 'Africa/Johannesburg',
  NBO: 'Africa/Nairobi', MBA: 'Africa/Nairobi',
  ADD: 'Africa/Addis_Ababa',
  CMN: 'Africa/Casablanca', RAK: 'Africa/Casablanca',
  TUN: 'Africa/Tunis', ALG: 'Africa/Algiers',
  LOS: 'Africa/Lagos', ABV: 'Africa/Lagos',
  ACC: 'Africa/Accra', DKR: 'Africa/Dakar',

  // Asia — East
  NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', NGO: 'Asia/Tokyo',
  ICN: 'Asia/Seoul', GMP: 'Asia/Seoul',
  PEK: 'Asia/Shanghai', PVG: 'Asia/Shanghai', SHA: 'Asia/Shanghai',
  CAN: 'Asia/Shanghai', CTU: 'Asia/Shanghai', SZX: 'Asia/Shanghai',
  KMG: 'Asia/Shanghai', XIY: 'Asia/Shanghai', WUH: 'Asia/Shanghai',
  HKG: 'Asia/Hong_Kong',
  TPE: 'Asia/Taipei', KHH: 'Asia/Taipei',
  // Asia — Southeast
  SIN: 'Asia/Singapore',
  KUL: 'Asia/Kuala_Lumpur', PEN: 'Asia/Kuala_Lumpur', BKI: 'Asia/Kuala_Lumpur',
  BKK: 'Asia/Bangkok', HKT: 'Asia/Bangkok', CNX: 'Asia/Bangkok',
  SGN: 'Asia/Ho_Chi_Minh', DAD: 'Asia/Ho_Chi_Minh', HAN: 'Asia/Ho_Chi_Minh',
  CGK: 'Asia/Jakarta', SUB: 'Asia/Jakarta',
  DPS: 'Asia/Makassar', UPG: 'Asia/Makassar',
  MNL: 'Asia/Manila', CEB: 'Asia/Manila',
  RGN: 'Asia/Rangoon',
  PNH: 'Asia/Phnom_Penh', REP: 'Asia/Phnom_Penh',
  VTE: 'Asia/Vientiane',
  // Asia — South
  DEL: 'Asia/Kolkata', BOM: 'Asia/Kolkata', MAA: 'Asia/Kolkata',
  BLR: 'Asia/Kolkata', CCU: 'Asia/Kolkata', HYD: 'Asia/Kolkata', GOI: 'Asia/Kolkata',
  KTM: 'Asia/Kathmandu',
  DAC: 'Asia/Dhaka', CGP: 'Asia/Dhaka',
  CMB: 'Asia/Colombo',
  MLE: 'Indian/Maldives',

  // Oceania
  SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', BNE: 'Australia/Brisbane',
  PER: 'Australia/Perth', ADL: 'Australia/Adelaide', CBR: 'Australia/Sydney',
  AKL: 'Pacific/Auckland', CHC: 'Pacific/Auckland',
  NAN: 'Pacific/Fiji',
}

function parseFlightDate(dateStr: string): Date | null {
  const MONTHS: Record<string, number> = {
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  }
  const m = (dateStr || '').toLowerCase().match(/(\d{1,2})\s+([a-záéíóú]{3})\s+(\d{4})/)
  if (!m) return null
  const month = MONTHS[m[2]]
  if (month === undefined) return null
  return new Date(Date.UTC(parseInt(m[3]), month, parseInt(m[1]), 12, 0, 0))
}

// Returns how many minutes ahead local time is vs UTC (e.g. UTC+2 → +120, UTC-5 → -300)
function tzOffsetMinutes(tz: string, ref: Date): number {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(ref)
  const parse = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
  let off = parse(fmt(tz)) - parse(fmt('UTC'))
  if (off > 720) off -= 1440
  if (off < -720) off += 1440
  return off
}

export function calcFlightDuration(
  fromIATA: string,
  depTime: string,
  toIATA: string,
  arrTime: string,
  flightDate: string,
  plus: string,
): string | null {
  const fromTz = AIRPORT_TZ[(fromIATA || '').toUpperCase().trim()]
  const toTz   = AIRPORT_TZ[(toIATA   || '').toUpperCase().trim()]

  // If we don't know both timezones, can't correct for them
  if (!fromTz || !toTz) return null

  if (!/^\d{1,2}:\d{2}$/.test(depTime) || !/^\d{1,2}:\d{2}$/.test(arrTime)) return null

  const ref = parseFlightDate(flightDate)
  if (!ref) return null

  const [dh, dm] = depTime.split(':').map(Number)
  const [ah, am] = arrTime.split(':').map(Number)
  const plusDays = parseInt((plus || '').replace(/[^0-9]/g, '') || '0')

  const offFrom = tzOffsetMinutes(fromTz, ref)
  const offTo   = tzOffsetMinutes(toTz,   ref)

  // Convert both times to minutes-since-midnight UTC
  const depUTC = dh * 60 + dm - offFrom
  const arrUTC = ah * 60 + am - offTo + plusDays * 1440

  let diff = arrUTC - depUTC
  // If diff is implausibly negative (forgot +1d) try adding 24h once
  if (diff <= 0) diff += 1440

  // Sanity: realistic flight times are 0h30m – 20h
  if (diff < 20 || diff > 1200) return null

  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h + 'h' + (m ? ' ' + m + 'm' : '')
}
