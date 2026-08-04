import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const all: unknown[] = []
  const PAGE = 1000

  for (let page = 0; ; page++) {
    const from = page * PAGE
    const { data, error } = await supabase
      .from('cotizador_clients')
      .select('*')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
  }

  return NextResponse.json(all)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { action, ...payload } = body

  if (action === 'insert') {
    const { error } = await supabase.from('cotizador_clients').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'update') {
    const { id, ...fields } = payload
    const { error } = await supabase.from('cotizador_clients').update(fields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const { error } = await supabase.from('cotizador_clients').delete().eq('id', payload.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
