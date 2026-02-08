import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const messages = db.prepare(
    "SELECT * FROM messages WHERE channel = 'home' ORDER BY created_at ASC"
  ).all()
  return NextResponse.json(messages)
}

export async function POST(request: Request) {
  const db = getDb()
  const { role, content, channel = 'home', attachments } = await request.json()
  const id = require('crypto').randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO messages (id, role, content, channel, attachments) VALUES (?, ?, ?, ?, ?)'
  ).run(id, role, content, channel, attachments ? JSON.stringify(attachments) : null)
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(id)
  return NextResponse.json(message)
}
