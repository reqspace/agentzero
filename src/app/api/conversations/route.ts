import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

export async function GET() {
  const db = getDb()
  const conversations = db.prepare(`
    SELECT c.*,
      (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
    FROM conversations c
    ORDER BY c.updated_at DESC
  `).all()
  return NextResponse.json(conversations)
}

export async function POST(request: Request) {
  const db = getDb()
  const { title } = await request.json().catch(() => ({ title: undefined }))
  const id = crypto.randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO conversations (id, title) VALUES (?, ?)'
  ).run(id, title || 'New Conversation')
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id)
  return NextResponse.json(conversation)
}
