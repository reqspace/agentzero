import { NextResponse } from 'next/server'
import { sendSms } from '@/lib/telnyx'
import { getDb } from '@/lib/db'
import { getOrCreateContact } from '@/lib/contacts'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    // Auth: check bearer token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    const expectedToken = process.env.SMS_API_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN
    if (!expectedToken || token !== expectedToken) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await request.json() as { to: string; text: string }
    if (!body.to || !body.text) {
      return NextResponse.json({ error: 'missing "to" and "text" fields' }, { status: 400 })
    }

    // Send via Telnyx
    await sendSms(body.to, body.text)

    // Log in database
    const db = getDb()
    const contact = getOrCreateContact(body.to, 'sms')
    const msgId = crypto.randomBytes(8).toString('hex')
    db.prepare(
      'INSERT INTO messages (id, role, content, channel, contact_id) VALUES (?, ?, ?, ?, ?)'
    ).run(msgId, 'agent', body.text, 'sms', contact.id)

    // Emit via Socket.IO if available
    const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
    io?.emit('message', { role: 'agent', content: body.text, channel: 'sms' })
    io?.emit('inbox:update', { type: 'sms_reply', contactId: contact.id })

    console.log(`[SMS API] Sent to ${body.to}: "${body.text.slice(0, 50)}..."`)
    return NextResponse.json({ ok: true, to: body.to })
  } catch (err) {
    console.error('[SMS API] Error:', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
