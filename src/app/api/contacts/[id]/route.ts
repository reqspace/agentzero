import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { clearUnread } from '@/lib/contacts'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id)
  if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get SMS messages for this contact
  const messages = db.prepare(
    'SELECT * FROM messages WHERE contact_id = ? ORDER BY created_at ASC'
  ).all(id)

  // Get call logs for this contact
  const calls = db.prepare(
    'SELECT * FROM call_logs WHERE contact_id = ? ORDER BY created_at ASC'
  ).all(id)

  // Mark as read
  clearUnread(id)

  return NextResponse.json({ contact, messages, calls })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { display_name } = await request.json()
  db.prepare('UPDATE contacts SET display_name = ? WHERE id = ?').run(display_name, id)
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id)
  return NextResponse.json(contact)
}
