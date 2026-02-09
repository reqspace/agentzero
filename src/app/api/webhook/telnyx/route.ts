import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getOrCreateContact, incrementUnread } from '@/lib/contacts'
import { answerCall, gatherUsingSpeak, hangupCall, isVoiceEnabled, getGreeting } from '@/lib/telnyx'
import { generateVoiceResponse } from '@/lib/llm'
import crypto from 'crypto'

type TelnyxWebhook = {
  data: {
    event_type: string
    payload: {
      // SMS fields
      text?: string
      from?: { phone_number?: string; carrier?: string }
      to?: { phone_number?: string }[] | string
      direction?: string
      type?: string
      id?: string
      // Call fields
      call_control_id?: string
      call_leg_id?: string
      call_session_id?: string
      client_state?: string
      state?: string
      // Gather fields
      speech?: { result?: string; status?: string }
      digits?: string
    }
  }
}

type ActiveCall = {
  callLogId: string
  contactId: string
  callerNumber: string
  turns: Array<{ role: 'caller' | 'agent'; content: string }>
}

function getIo() {
  return (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
}

function getActiveCalls() {
  return (global as Record<string, unknown>).activeCalls as Map<string, ActiveCall> | undefined
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TelnyxWebhook
    const event = body?.data?.event_type
    const payload = body?.data?.payload

    if (!event || !payload) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Route SMS events
    if (event.startsWith('message.')) {
      return handleSmsEvent(event, payload)
    }

    // Route call events
    if (event.startsWith('call.')) {
      return handleCallEvent(event, payload)
    }

    return NextResponse.json({ ok: true, skipped: true })
  } catch (err) {
    console.error('[Telnyx Webhook] Error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

// ─── SMS Handling ───────────────────────────────────────────────

function handleSmsEvent(event: string, payload: TelnyxWebhook['data']['payload']) {
  if (event !== 'message.received' || !payload.text) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const text = payload.text
  const from = payload.from?.phone_number || 'unknown'
  const db = getDb()
  const io = getIo()

  // Track contact
  const contact = getOrCreateContact(from, 'sms')
  incrementUnread(contact.id)

  // Store as a user message in the sms channel
  const msgId = crypto.randomBytes(8).toString('hex')
  const content = `[SMS from ${from}] ${text}`
  db.prepare(
    'INSERT INTO messages (id, role, content, channel, contact_id) VALUES (?, ?, ?, ?, ?)'
  ).run(msgId, 'user', content, 'sms', contact.id)

  // Emit via Socket.IO
  io?.emit('message', { role: 'user', content, channel: 'sms' })
  io?.emit('inbox:update', { type: 'sms', contactId: contact.id, from })

  // Forward to OpenClaw — if connected, it will auto-reply via server.ts handler
  const clawClient = (global as Record<string, unknown>).clawClient as { sendCommand: (t: string, c?: string) => void; authenticated: boolean } | undefined
  const pendingSmsReplies = (global as Record<string, unknown>).pendingSmsReplies as Map<string, { phoneNumber: string; contactId: string; timestamp: number }> | undefined
  console.log(`[SMS] Received from ${from}: "${text}" | OpenClaw authenticated: ${clawClient?.authenticated}`)
  if (clawClient?.authenticated) {
    const smsPrompt = content
    console.log(`[SMS] Forwarding to OpenClaw on 'main' channel: "${content}"`)
    // Register pending reply so server.ts knows to auto-reply via SMS from agent responds
    pendingSmsReplies?.set(from, { phoneNumber: from, contactId: contact.id, timestamp: Date.now() })
    clawClient.sendCommand(smsPrompt, 'main')
  } else {
    console.log('[SMS] OpenClaw not connected, using direct LLM fallback')
    // OpenClaw not connected — generate direct LLM reply and send via SMS
    generateSmsReply(text, from, contact.id, db, io).catch(err => {
      console.error('[SMS] Direct reply failed:', err)
    })
  }

  return NextResponse.json({ ok: true })
}

async function generateSmsReply(
  incomingText: string,
  fromNumber: string,
  contactId: string,
  db: ReturnType<typeof getDb>,
  io: ReturnType<typeof getIo>
) {
  const { generateVoiceResponse } = await import('@/lib/llm')
  const { sendSms } = await import('@/lib/telnyx')

  // Build conversation context from recent SMS history with this contact
  const recentMessages = db.prepare(
    "SELECT role, content FROM messages WHERE contact_id = ? AND channel = 'sms' ORDER BY created_at DESC LIMIT 10"
  ).all(contactId) as { role: string; content: string }[]

  const turns = recentMessages.reverse().map(m => ({
    role: (m.role === 'user' ? 'caller' : 'agent') as 'caller' | 'agent',
    content: m.content.replace(/\[SMS from [^\]]+\]\s*/, ''),
  }))

  const reply = await generateVoiceResponse(turns)

  // Save agent reply to DB
  const replyId = crypto.randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO messages (id, role, content, channel, contact_id) VALUES (?, ?, ?, ?, ?)'
  ).run(replyId, 'agent', reply, 'sms', contactId)

  // Emit via Socket.IO
  io?.emit('message', { role: 'agent', content: reply, channel: 'sms' })
  io?.emit('inbox:update', { type: 'sms_reply', contactId })

  // Send via Telnyx
  await sendSms(fromNumber, reply)
  console.log(`[SMS] Auto-replied to ${fromNumber}: "${reply.slice(0, 50)}..."`)
}

// ─── Call Handling ──────────────────────────────────────────────

async function handleCallEvent(event: string, payload: TelnyxWebhook['data']['payload']) {
  const callControlId = payload.call_control_id
  if (!callControlId) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const db = getDb()
  const io = getIo()
  const activeCalls = getActiveCalls()

  switch (event) {
    case 'call.initiated': {
      if (payload.direction !== 'incoming') {
        return NextResponse.json({ ok: true, skipped: true })
      }

      if (!isVoiceEnabled()) {
        console.log('[Telnyx] Voice not enabled, ignoring call from', payload.from?.phone_number)
        return NextResponse.json({ ok: true, skipped: true })
      }

      const callerNumber = payload.from?.phone_number || 'unknown'
      const calleeNumber = typeof payload.to === 'string' ? payload.to : payload.to?.[0]?.phone_number || ''

      // Create/find contact
      const contact = getOrCreateContact(callerNumber, 'voice')
      incrementUnread(contact.id)

      // Create call log
      const callLogId = crypto.randomBytes(8).toString('hex')
      db.prepare(`
        INSERT INTO call_logs (id, telnyx_call_control_id, contact_id, caller_number, callee_number, direction, status)
        VALUES (?, ?, ?, ?, ?, 'inbound', 'initiated')
      `).run(callLogId, callControlId, contact.id, callerNumber, calleeNumber)

      // Store in active calls
      activeCalls?.set(callControlId, {
        callLogId,
        contactId: contact.id,
        callerNumber,
        turns: [],
      })

      // Emit real-time event
      io?.emit('call:new', { callLogId, callerNumber, contactId: contact.id })
      io?.emit('inbox:update', { type: 'call', contactId: contact.id })

      // Answer the call
      try {
        await answerCall(callControlId, callLogId)
        console.log(`[Telnyx] Answering call from ${callerNumber}`)
      } catch (err) {
        console.error('[Telnyx] Failed to answer call:', err)
        db.prepare('UPDATE call_logs SET status = ? WHERE id = ?').run('failed', callLogId)
      }

      return NextResponse.json({ ok: true })
    }

    case 'call.answered': {
      const activeCall = activeCalls?.get(callControlId)
      if (!activeCall) return NextResponse.json({ ok: true })

      // Update call status
      db.prepare('UPDATE call_logs SET status = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('answered', activeCall.callLogId)

      // Speak greeting and start listening
      const greeting = getGreeting()
      try {
        await gatherUsingSpeak(callControlId, greeting)
        console.log(`[Telnyx] Playing greeting for call ${activeCall.callLogId}`)

        // Save agent greeting as first turn
        const turnId = crypto.randomBytes(8).toString('hex')
        db.prepare('INSERT INTO call_transcript_turns (id, call_id, role, content) VALUES (?, ?, ?, ?)')
          .run(turnId, activeCall.callLogId, 'agent', greeting)
        activeCall.turns.push({ role: 'agent', content: greeting })
      } catch (err) {
        console.error('[Telnyx] Failed to play greeting:', err)
      }

      return NextResponse.json({ ok: true })
    }

    case 'call.gather.ended': {
      const activeCall = activeCalls?.get(callControlId)
      if (!activeCall) return NextResponse.json({ ok: true })

      // Extract speech or digits
      const spokenText = payload.speech?.result || payload.digits || ''
      if (!spokenText || payload.speech?.status === 'no_speech_detected') {
        // No speech detected — try gathering again
        try {
          await gatherUsingSpeak(callControlId, 'Are you still there? I\'m listening.')
        } catch {
          // Call may have ended
        }
        return NextResponse.json({ ok: true })
      }

      console.log(`[Telnyx] Caller said: "${spokenText}"`)

      // Save caller turn
      const callerTurnId = crypto.randomBytes(8).toString('hex')
      db.prepare('INSERT INTO call_transcript_turns (id, call_id, role, content) VALUES (?, ?, ?, ?)')
        .run(callerTurnId, activeCall.callLogId, 'caller', spokenText)
      activeCall.turns.push({ role: 'caller', content: spokenText })

      // Emit real-time transcript update
      io?.emit('call:turn', {
        callLogId: activeCall.callLogId,
        role: 'caller',
        content: spokenText,
      })

      // Generate AI response
      const aiResponse = await generateVoiceResponse(activeCall.turns)
      console.log(`[Telnyx] Agent says: "${aiResponse}"`)

      // Save agent turn
      const agentTurnId = crypto.randomBytes(8).toString('hex')
      db.prepare('INSERT INTO call_transcript_turns (id, call_id, role, content) VALUES (?, ?, ?, ?)')
        .run(agentTurnId, activeCall.callLogId, 'agent', aiResponse)
      activeCall.turns.push({ role: 'agent', content: aiResponse })

      io?.emit('call:turn', {
        callLogId: activeCall.callLogId,
        role: 'agent',
        content: aiResponse,
      })

      // Update call status to active
      db.prepare('UPDATE call_logs SET status = ? WHERE id = ?').run('active', activeCall.callLogId)

      // Speak response and listen for next input
      try {
        await gatherUsingSpeak(callControlId, aiResponse)
      } catch (err) {
        console.error('[Telnyx] Failed to speak response:', err)
      }

      return NextResponse.json({ ok: true })
    }

    case 'call.speak.ended': {
      // Handled by gather_using_speak cycle — no action needed
      return NextResponse.json({ ok: true })
    }

    case 'call.hangup': {
      const activeCall = activeCalls?.get(callControlId)
      if (!activeCall) return NextResponse.json({ ok: true })

      // Build full transcript
      const transcript = activeCall.turns
        .map(t => `${t.role === 'caller' ? 'Caller' : 'Agent Zero'}: ${t.content}`)
        .join('\n\n')

      // Calculate duration
      const callLog = db.prepare('SELECT * FROM call_logs WHERE id = ?').get(activeCall.callLogId) as { answered_at: string | null } | undefined
      let duration = 0
      if (callLog?.answered_at) {
        duration = Math.round((Date.now() - new Date(callLog.answered_at).getTime()) / 1000)
      }

      // Update call log
      db.prepare(`
        UPDATE call_logs
        SET status = 'completed', duration_seconds = ?, transcript = ?, ended_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(duration, transcript, activeCall.callLogId)

      // Update contact
      db.prepare('UPDATE contacts SET last_interaction_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(activeCall.contactId)

      // Clean up
      activeCalls?.delete(callControlId)

      // Emit events
      io?.emit('call:ended', {
        callLogId: activeCall.callLogId,
        duration,
        callerNumber: activeCall.callerNumber,
      })
      io?.emit('inbox:update', { type: 'call_ended', contactId: activeCall.contactId })

      console.log(`[Telnyx] Call ended: ${activeCall.callLogId}, duration: ${duration}s, ${activeCall.turns.length} turns`)

      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ ok: true, skipped: true })
  }
}
