import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const settings = db.prepare('SELECT * FROM settings').all()
  return NextResponse.json(settings)
}

export async function POST(request: Request) {
  const db = getDb()
  const { key, value, encrypted = 0 } = await request.json()
  db.prepare(
    'INSERT OR REPLACE INTO settings (key, value, encrypted, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(key, value, encrypted)
  return NextResponse.json({ ok: true })
}
