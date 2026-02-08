import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const logs = db.prepare('SELECT * FROM logs ORDER BY id ASC').all()
  return NextResponse.json(logs)
}

export async function POST(request: Request) {
  const db = getDb()
  const { level = 'INFO', message, source } = await request.json()
  const result = db.prepare(
    'INSERT INTO logs (level, message, source) VALUES (?, ?, ?)'
  ).run(level, message, source || null)

  const log = db.prepare('SELECT * FROM logs WHERE id = ?').get(result.lastInsertRowid)

  const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
  io?.emit('log', log)

  return NextResponse.json(log)
}

export async function DELETE() {
  const db = getDb()
  db.prepare('DELETE FROM logs').run()
  return NextResponse.json({ ok: true })
}
