import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const messages = db.prepare(
    'SELECT * FROM channel_messages WHERE channel_id = ? ORDER BY created_at ASC'
  ).all(id)
  return NextResponse.json(messages)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: channelId } = await params
  const db = getDb()
  const { content, role } = await request.json()
  const msgId = require('crypto').randomBytes(8).toString('hex')

  db.prepare(
    'INSERT INTO channel_messages (id, channel_id, role, content) VALUES (?, ?, ?, ?)'
  ).run(msgId, channelId, role, content)

  db.prepare(
    'UPDATE channels SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(channelId)

  const message = db.prepare('SELECT * FROM channel_messages WHERE id = ?').get(msgId)

  const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
  io?.emit('message', { ...message as object, channel: channelId })

  return NextResponse.json(message)
}
