import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  // Get all contacts with their latest interaction info
  const contacts = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sms,
      (SELECT created_at FROM messages WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sms_at,
      (SELECT status FROM call_logs WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_call_status,
      (SELECT duration_seconds FROM call_logs WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_call_duration,
      (SELECT created_at FROM call_logs WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_call_at,
      (SELECT COUNT(*) FROM messages WHERE contact_id = c.id) as sms_count,
      (SELECT COUNT(*) FROM call_logs WHERE contact_id = c.id) as call_count
    FROM contacts c
    ORDER BY c.last_interaction_at DESC
  `).all()

  return NextResponse.json(contacts)
}
