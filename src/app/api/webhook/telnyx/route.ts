import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

// Telnyx sends webhooks wrapped in { data: { event_type, payload } }
type TelnyxWebhook = {
  data: {
    event_type: string
    payload: {
      text?: string
      from?: { phone_number?: string; carrier?: string }
      to?: { phone_number?: string }[]
      direction?: string
      type?: string
      id?: string
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TelnyxWebhook
    const event = body?.data?.event_type
    const payload = body?.data?.payload

    // Only handle inbound messages
    if (event !== 'message.received' || !payload?.text) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const text = payload.text
    const from = payload.from?.phone_number || 'unknown'
    const db = getDb()

    // Store as a user message in the sms channel
    const msgId = crypto.randomBytes(8).toString('hex')
    const content = `[SMS from ${from}] ${text}`
    db.prepare(
      'INSERT INTO messages (id, role, content, channel) VALUES (?, ?, ?, ?)'
    ).run(msgId, 'user', content, 'sms')

    // Emit via Socket.IO
    const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
    io?.emit('message', { role: 'user', content, channel: 'sms' })

    // Forward to OpenClaw
    const clawClient = (global as Record<string, unknown>).clawClient as { sendCommand: (t: string, c?: string) => void; authenticated: boolean } | undefined
    if (clawClient?.authenticated) {
      clawClient.sendCommand(content, 'sms')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Telnyx Webhook] Error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
