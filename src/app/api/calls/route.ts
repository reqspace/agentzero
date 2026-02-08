import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: Request) {
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contact_id')

  let calls
  if (contactId) {
    calls = db.prepare(`
      SELECT cl.*, c.phone_number, c.display_name
      FROM call_logs cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      WHERE cl.contact_id = ?
      ORDER BY cl.created_at DESC
    `).all(contactId)
  } else {
    calls = db.prepare(`
      SELECT cl.*, c.phone_number, c.display_name
      FROM call_logs cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      ORDER BY cl.created_at DESC
      LIMIT 100
    `).all()
  }

  return NextResponse.json(calls)
}
