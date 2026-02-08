import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  const role = searchParams.get('role')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!q) return NextResponse.json([])

  const db = getDb()
  let sql = `
    SELECT m.*, c.title as conversation_title
    FROM messages m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE m.channel = 'home' AND m.content LIKE ?
  `
  const params: unknown[] = [`%${q}%`]

  if (role && (role === 'user' || role === 'agent')) {
    sql += ' AND m.role = ?'
    params.push(role)
  }
  if (from) {
    sql += ' AND m.created_at >= ?'
    params.push(from)
  }
  if (to) {
    sql += ' AND m.created_at <= ?'
    params.push(to)
  }

  sql += ' ORDER BY m.created_at DESC LIMIT 100'

  const results = db.prepare(sql).all(...params)
  return NextResponse.json(results)
}
