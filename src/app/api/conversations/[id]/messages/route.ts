import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const messages = db.prepare(
    "SELECT * FROM messages WHERE conversation_id = ? AND channel = 'home' ORDER BY created_at ASC"
  ).all(id)
  return NextResponse.json(messages)
}
