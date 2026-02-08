import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const updates = await request.json()

  const fields: string[] = []
  const values: unknown[] = []

  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
    if (updates.status === 'done') {
      fields.push('completed_at = CURRENT_TIMESTAMP')
    }
  }
  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority) }
  if (updates.progress !== undefined) { fields.push('progress = ?'); values.push(updates.progress) }
  if (updates.column_order !== undefined) { fields.push('column_order = ?'); values.push(updates.column_order) }

  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)

  const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
  io?.emit('task:update', { taskId: id, status: updates.status })

  return NextResponse.json(task)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
