import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('cotizador_next_quote_number')
    if (error) throw error
    return NextResponse.json({ value: data as number })
  } catch {
    // Fall back to 1 if DB not set up yet
    return NextResponse.json({ value: 1 })
  }
}
