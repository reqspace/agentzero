import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY column_order ASC').all()
  return NextResponse.json(tasks)
}

export async function POST(request: Request) {
  const db = getDb()
  const { title, description, priority = 'med', skill, status = 'backlog', tags } = await request.json()
  const id = require('crypto').randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO tasks (id, title, description, priority, skill, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, description || null, priority, skill || null, status, tags ? JSON.stringify(tags) : null)
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)

  const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
  io?.emit('task:update', { taskId: id, status })

  return NextResponse.json(task)
}
