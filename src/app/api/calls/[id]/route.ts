import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const call = db.prepare(`
    SELECT cl.*, c.phone_number, c.display_name
    FROM call_logs cl
    LEFT JOIN contacts c ON cl.contact_id = c.id
    WHERE cl.id = ?
  `).get(id)

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const turns = db.prepare(
    'SELECT * FROM call_transcript_turns WHERE call_id = ? ORDER BY created_at ASC'
  ).all(id)

  return NextResponse.json({ call, turns })
}
