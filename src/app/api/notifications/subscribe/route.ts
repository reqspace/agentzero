import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function POST(request: Request) {
  const db = getDb()
  const subscription = await request.json()

  db.prepare(
    'INSERT OR REPLACE INTO push_subscriptions (endpoint, keys) VALUES (?, ?)'
  ).run(subscription.endpoint, JSON.stringify(subscription.keys))

  return NextResponse.json({ ok: true })
}

export async function GET() {
  // Return VAPID public key for client subscription
  return NextResponse.json({
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
  })
}
