import { createServer } from 'http'
import next from 'next'
import { Server as SocketServer } from 'socket.io'
import { verifyToken } from '@clerk/backend'
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
      case 'agent_lifecycle': {
        const lc = data.payload as { runId: string; phase: string }
        if (lc.phase === 'end' || lc.phase === 'error') {
          const taskId = runTaskMap.get(lc.runId)
          if (taskId) {
            const newStatus = lc.phase === 'error' ? 'failed' : 'done'
            try {
              db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(newStatus, taskId)
              io.emit('task:update', { taskId, status: newStatus })
              console.log(`[Tasks] Run ${lc.runId} ${lc.phase} → task ${taskId} → ${newStatus}`)
            } catch (err) {
              console.error('[Tasks] Failed to update task:', err)
            }
            runTaskMap.delete(lc.runId)
          }
        }
        break
      }
      case 'agent_tool': {
        const tool = data.payload as { runId: string; name?: string }
        const taskId = runTaskMap.get(tool.runId)
        if (taskId && tool.name) {
          try {
            db.prepare('UPDATE tasks SET description = COALESCE(description, \'\') || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(`\n- ${tool.name}`, taskId)
          } catch { /* best effort */ }
        }
        break
      }
      case 'status':
        io.emit('agent:status', data.payload)
        break
    }
  })

  // Track OpenClaw runId → dashboard taskId for auto-updating tasks
  const runTaskMap = new Map<string, string>()

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

  // Socket.IO auth middleware — verify Clerk session token
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      return next(new Error('Authentication required'))
    }
    try {
      const secretKey = process.env.CLERK_SECRET_KEY
      if (!secretKey) {
        console.error('[Socket.IO] CLERK_SECRET_KEY not set')
        return next(new Error('Server auth not configured'))
      }
      const result = await verifyToken(token, { secretKey })
      if (result.errors) {
        console.warn('[Socket.IO] Invalid token:', result.errors)
        return next(new Error('Invalid session'))
      }
      const payload = result.data as { sub: string }
      // Attach user info to socket for potential later use
      socket.data.userId = payload.sub
      next()
    } catch (err) {
      console.warn('[Socket.IO] Token verification failed:', err)
      return next(new Error('Invalid session'))
    }
  })

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

    socket.on('command', (data: { text: string; channel?: string; conversation_id?: string; attachments?: string[] }, ack?: (res: { ok: boolean }) => void) => {
      const text = data.text?.trim()
      if (!text) { ack?.({ ok: false }); return }

      // Save user message to DB
      try {
        const msgId = require('crypto').randomBytes(8).toString('hex')
        db.prepare(
          'INSERT INTO messages (id, role, content, channel, attachments, conversation_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(msgId, 'user', text, 'home', data.attachments ? JSON.stringify(data.attachments) : null, data.conversation_id || null)
        if (data.conversation_id) {
          db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(data.conversation_id)
        }
      } catch (err) {
        console.error('[Socket.IO] Failed to save user message:', err)
      }

      // Forward to OpenClaw gateway and create a task to track it
      if (clawClient.authenticated) {
        const runId = clawClient.sendCommand(text, 'main')
        if (runId) {
          try {
            const taskId = require('crypto').randomBytes(8).toString('hex')
            db.prepare(
              'INSERT INTO tasks (id, title, status, priority) VALUES (?, ?, ?, ?)'
            ).run(taskId, text.slice(0, 100), 'running', 'med')
            runTaskMap.set(runId, taskId)
            io.emit('task:update', { taskId, status: 'running' })
            console.log(`[Tasks] Created task ${taskId} for run ${runId}: "${text.slice(0, 60)}"`)
          } catch (err) {
            console.error('[Tasks] Failed to create task:', err)
          }
        }
        console.log(`[Socket.IO] Forwarded to OpenClaw: "${text.slice(0, 80)}"`)
      } else {
        console.warn(`[Socket.IO] OpenClaw not authenticated, message not forwarded: "${text.slice(0, 60)}"`)
      }
      ack?.({ ok: true })
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
