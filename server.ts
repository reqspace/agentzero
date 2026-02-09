import { createServer } from 'http'
import next from 'next'
import { Server as SocketServer } from 'socket.io'
import { getDb } from './src/lib/db'
import { OpenClawClient } from './src/lib/openclaw-client'

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res)
  })

  const io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  })

  // Make io globally accessible for API routes
  ;(global as Record<string, unknown>).io = io

  // Initialize database
  const db = getDb()
  ;(global as Record<string, unknown>).db = db

  // Log Telnyx config at startup
  console.log(`[Config] TELNYX_API_KEY: ${process.env.TELNYX_API_KEY ? 'set (' + process.env.TELNYX_API_KEY.slice(0, 8) + '...)' : 'NOT SET'}`)
  console.log(`[Config] TELNYX_PHONE_NUMBER: ${process.env.TELNYX_PHONE_NUMBER || 'NOT SET'}`)

  // Connect to OpenClaw gateway with cost guard
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || (db.prepare('SELECT value FROM settings WHERE key = ?').get('gateway_address') as { value: string })?.value || 'wss://openclaw.reqspace.cloud'
  const dailyLimit = parseFloat((db.prepare('SELECT value FROM settings WHERE key = ?').get('daily_cost_limit') as { value: string })?.value || '25')
  const clawClient = new OpenClawClient(gatewayUrl, {
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
    dailyLimit,
  })
  ;(global as Record<string, unknown>).clawClient = clawClient

  clawClient.onMessage((data) => {
    switch (data.type) {
      case 'log':
        io.emit('log', data.payload)
        break
      case 'task_update':
        io.emit('task:update', data.payload)
        break
      case 'message': {
        const msg = data.payload as { role: string; content: string; channel?: string; conversation_id?: string; streaming?: boolean; sessionKey?: string }
        // Persist non-streaming agent messages to the database
        if (msg.role === 'agent' && msg.content && !msg.streaming) {
          try {
            const id = require('crypto').randomBytes(8).toString('hex')
            db.prepare(
              'INSERT INTO messages (id, role, content, channel, conversation_id) VALUES (?, ?, ?, ?, ?)'
            ).run(id, 'agent', msg.content, msg.channel || 'home', msg.conversation_id || null)
          } catch (err) {
            console.error('[DB] Failed to save agent message:', err)
          }

          // Auto-reply via SMS — ONLY from the 'main' session (where SMS messages are sent)
          // Ignore responses from other sessions (webchat 'agent:main:main', 'home', etc.)
          if (pendingSmsReplies.size > 0 && msg.sessionKey === 'main') {
            const [key, pending] = pendingSmsReplies.entries().next().value as [string, { phoneNumber: string; contactId: string; timestamp: number }]
            if (Date.now() - pending.timestamp < 5 * 60 * 1000) {
              pendingSmsReplies.delete(key)
              console.log(`[SMS] Got response from 'main' session (${msg.content.length} chars), sending to ${pending.phoneNumber}`)
              try {
                const smsReplyId = require('crypto').randomBytes(8).toString('hex')
                db.prepare(
                  'INSERT INTO messages (id, role, content, channel, contact_id) VALUES (?, ?, ?, ?, ?)'
                ).run(smsReplyId, 'agent', msg.content, 'sms', pending.contactId)
                const { sendSms } = require('./src/lib/telnyx')
                sendSms(pending.phoneNumber, msg.content).then(() => {
                  console.log(`[SMS] Auto-replied to ${pending.phoneNumber}: "${msg.content.slice(0, 80)}..."`)
                }).catch((err: Error) => {
                  console.error('[SMS] Failed to auto-reply:', err.message)
                })
              } catch (err) {
                console.error('[SMS] Auto-reply error:', err)
              }
            } else {
              pendingSmsReplies.delete(key)
            }
          }
        }
        io.emit('message', data.payload)
        break
      }
      case 'status':
        io.emit('agent:status', data.payload)
        break
    }
  })

  // Pending SMS replies: tracks phone numbers waiting for agent responses
  const pendingSmsReplies = new Map<string, { phoneNumber: string; contactId: string; timestamp: number }>()
  ;(global as Record<string, unknown>).pendingSmsReplies = pendingSmsReplies

  // Active voice call sessions: maps call_control_id -> conversation context
  const activeCalls = new Map<string, {
    callLogId: string
    contactId: string
    callerNumber: string
    turns: Array<{ role: 'caller' | 'agent'; content: string }>
  }>()
  ;(global as Record<string, unknown>).activeCalls = activeCalls

  // Attempt gateway connection (won't crash if unavailable)
  clawClient.connect()

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`)

    // Send initial agent status (use authenticated, not just connected)
    socket.emit('agent:status', { online: clawClient.authenticated, uptime: process.uptime() })

    socket.on('subscribe:logs', () => {
      socket.join('logs')
    })

    socket.on('subscribe:activity', () => {
      socket.join('activity')
    })

    socket.on('subscribe:calls', () => {
      socket.join('calls')
    })

    socket.on('subscribe:inbox', () => {
      socket.join('inbox')
    })

    socket.on('command', (data: { text: string; channel?: string }) => {
      clawClient.sendCommand(data.text, data.channel)
    })

    socket.on('task:move', (data: { taskId: string; newStatus: string; order: number }) => {
      try {
        db.prepare('UPDATE tasks SET status = ?, column_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(data.newStatus, data.order, data.taskId)
        io.emit('task:update', { taskId: data.taskId, status: data.newStatus })
      } catch (err) {
        console.error('[Socket.IO] task:move error:', err)
      }
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`)
    })
  })

  server.listen(port, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║       Agent Zero Mission Control         ║
  ║                                          ║
  ║  → http://localhost:${port}                 ║
  ║  → Socket.IO ready                       ║
  ║  → SQLite initialized                    ║
  ╚══════════════════════════════════════════╝
    `)
  })
})
