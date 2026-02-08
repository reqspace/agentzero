import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: Request) {
  const db = getDb()
  const { type = 'info', title, body, icon } = await request.json()

  // Store notification
  const id = crypto.randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO notifications (id, type, title, body, icon) VALUES (?, ?, ?, ?, ?)'
  ).run(id, type, title, body || null, icon || null)

  // Emit via Socket.IO
  const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
  io?.emit('notification', { type, title, body })

  // Send web push to all subscribers
  try {
    const webpush = await import('web-push')
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const email = process.env.VAPID_EMAIL || 'mailto:admin@agentzero.dev'

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey)

      const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all() as {
        endpoint: string
        keys: string
      }[]

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) },
            JSON.stringify({ title, body, icon, type })
          )
        } catch {
          // Remove invalid subscription
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint)
        }
      }
    }
  } catch {
    // web-push not configured
  }

  return NextResponse.json({ ok: true, id })
}

export async function GET() {
  const db = getDb()
  const notifications = db.prepare(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
  ).all()
  return NextResponse.json(notifications)
}
