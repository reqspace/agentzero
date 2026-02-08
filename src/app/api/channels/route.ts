import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const channels = db.prepare('SELECT * FROM channels ORDER BY name ASC').all()
  return NextResponse.json(channels)
}
