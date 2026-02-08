import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: Request) {
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversation_id')

  let messages
  if (conversationId) {
    messages = db.prepare(
      "SELECT * FROM messages WHERE channel = 'home' AND conversation_id = ? ORDER BY created_at ASC"
    ).all(conversationId)
  } else {
    // Backward compat: return messages with no conversation_id (legacy)
    messages = db.prepare(
      "SELECT * FROM messages WHERE channel = 'home' AND conversation_id IS NULL ORDER BY created_at ASC"
    ).all()
  }
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const db = getDb()
  const { role, content, channel = 'home', attachments, conversation_id } = await request.json()
  const id = require('crypto').randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO messages (id, role, content, channel, attachments, conversation_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, role, content, channel, attachments ? JSON.stringify(attachments) : null, conversation_id || null)
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id)
  return NextResponse.json(message)
}
