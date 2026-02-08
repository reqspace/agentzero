import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getOrCreateContact } from '@/lib/contacts'

export async function GET() {
  const db = getDb()
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY last_interaction_at DESC').all()
  return NextResponse.json(contacts)
}

export async function POST(request: Request) {
  const { phone_number, display_name, type = 'sms' } = await request.json()
  if (!phone_number) return NextResponse.json({ error: 'phone_number required' }, { status: 400 })

  const contact = getOrCreateContact(phone_number, type)
  if (display_name) {
    const db = getDb()
    db.prepare('UPDATE contacts SET display_name = ? WHERE id = ?').run(display_name, contact.id)
    contact.display_name = display_name
  }

  return NextResponse.json(contact)
}
