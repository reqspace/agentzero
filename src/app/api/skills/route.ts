import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const skills = db.prepare('SELECT * FROM skills ORDER BY active DESC, name ASC').all()
  return NextResponse.json(skills)
}
