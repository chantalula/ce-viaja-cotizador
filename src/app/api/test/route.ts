import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('cotizador_counters').select('*').limit(1)
    return NextResponse.json({ url, keyStart: key?.slice(0, 20), data, error: error?.message })
  } catch (e) {
    return NextResponse.json({ url, keyStart: key?.slice(0, 20), threw: String(e) })
  }
}
