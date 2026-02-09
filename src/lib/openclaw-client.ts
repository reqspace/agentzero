import WebSocket from 'ws'
import crypto from 'crypto'

type MessageHandler = (data: { type: string; payload: unknown }) => void

interface CostTracker {
  todaySpend: number
  dailyLimit: number
  sessionTokensIn: number
  sessionTokensOut: number
  lastReset: string
}

export class OpenClawClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private reconnectAttempts = 0
  private handlers: MessageHandler[] = []
  private requestId = 0
  private authToken: string = ''
  public connected = false
  public authenticated = false

  // Cost circuit breaker
  public costs: CostTracker = {
    todaySpend: 0,
    dailyLimit: 25,
    sessionTokensIn: 0,
    sessionTokensOut: 0,
    lastReset: new Date().toDateString(),
  }

  constructor(
    private gatewayUrl: string,
    options?: { token?: string; dailyLimit?: number }
  ) {
    this.authToken = options?.token || process.env.OPENCLAW_GATEWAY_TOKEN || ''
    if (options?.dailyLimit) this.costs.dailyLimit = options.dailyLimit
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler)
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.gatewayUrl)

      this.ws.on('open', () => {
        this.connected = true
        this.reconnectDelay = 1000
        this.reconnectAttempts = 0
        console.log(`[OpenClaw] Connected to gateway: ${this.gatewayUrl}`)
        // Don't send handshake here — wait for connect.challenge event
      })

      this.ws.on('close', () => {
        this.connected = false
        this.authenticated = false
        if (this.reconnectAttempts < 3) {
          console.log('[OpenClaw] Disconnected from gateway, retrying...')
        }
        this.scheduleReconnect()
      })

      this.ws.on('error', (err) => {
        if (this.reconnectAttempts < 3) {
          console.log(`[OpenClaw] Gateway unavailable: ${err.message}`)
        } else if (this.reconnectAttempts === 3) {
          console.log('[OpenClaw] Gateway offline. Will keep retrying silently.')
        }
      })

      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          // Log all non-tick messages for debugging
          if (msg.event !== 'tick') {
            const preview = JSON.stringify(msg).slice(0, 200)
            console.log(`[OpenClaw] ← ${preview}`)
          }
          this.handleProtocolMessage(msg)
        } catch {
          // ignore parse errors
        }
      })
    } catch {
      this.scheduleReconnect()
    }
  }

  // OpenClaw Protocol v3 handshake — must be called after receiving connect.challenge
  private sendHandshake(): void {
    this.send({
      type: 'req',
      id: this.nextId(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'gateway-client',
          displayName: 'Agent Zero Mission Control',
          version: '0.1.0',
          platform: process.platform,
          mode: 'backend',
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin'],
        caps: [],
        auth: this.authToken ? { token: this.authToken } : undefined,
      },
    })
  }

  private handleProtocolMessage(msg: {
    type: string
    id?: string
    event?: string
    ok?: boolean
    payload?: Record<string, unknown>
    error?: { code: string; message: string }
  }): void {
    // Handle successful connect response
    if (msg.type === 'res' && msg.ok === true && !this.authenticated) {
      this.authenticated = true
      console.log('[OpenClaw] Authenticated with gateway (protocol v3)')
      this.handlers.forEach(h => h({ type: 'status', payload: { online: true } }))
      return
    }

    // Handle auth failure
    if (msg.type === 'res' && msg.ok === false) {
      console.error(`[OpenClaw] Error: ${msg.error?.code} — ${msg.error?.message}`)
      this.handlers.forEach(h => h({
        type: 'log',
        payload: { level: 'ERROR', message: `Gateway: ${msg.error?.message}`, source: 'openclaw' },
      }))
      return
    }

    // Handle events (agent responses, presence, etc.)
    if (msg.type === 'event') {
      this.handleEvent(msg.event!, msg.payload!)
      return
    }

    // Handle agent run response
    if (msg.type === 'res' && msg.ok && msg.payload) {
      // Track tokens for cost estimation
      const usage = msg.payload.usage as { input_tokens?: number; output_tokens?: number } | undefined
      if (usage) {
        this.trackUsage(usage.input_tokens || 0, usage.output_tokens || 0)
      }
      this.handlers.forEach(h => h({ type: 'response', payload: msg.payload }))
    }
  }

  private handleEvent(event: string, payload: Record<string, unknown>): void {
    switch (event) {
      case 'connect.challenge': {
        // Server sends challenge — respond with connect handshake
        console.log('[OpenClaw] Received connect.challenge, sending handshake...')
        this.sendHandshake()
        break
      }

      case 'agent': {
        // Agent event payload: { stream, data: { text, phase, name }, runId, seq, ... }
        const data = payload.data as { text?: string; phase?: string; name?: string } | undefined
        const stream = payload.stream as string | undefined
        const runId = payload.runId as string | undefined
        const textContent = data?.text || ''
        if (stream === 'assistant' && textContent) {
          this.handlers.forEach(h => h({
            type: 'message',
            payload: {
              role: 'agent',
              content: textContent,
              channel: 'home',
              streaming: true,
            },
          }))
        }
        // Lifecycle events: agent run start/end/error
        if (stream === 'lifecycle' && data?.phase && runId) {
          this.handlers.forEach(h => h({
            type: 'agent_lifecycle',
            payload: { runId, phase: data.phase, error: data.phase === 'error' ? data : undefined },
          }))
        }
        // Tool events: agent is using a tool
        if (stream === 'tool' && runId) {
          this.handlers.forEach(h => h({
            type: 'agent_tool',
            payload: { runId, name: data?.name },
          }))
        }
        // Track token usage from agent events
        const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined
        if (usage) {
          this.trackUsage(usage.input_tokens || 0, usage.output_tokens || 0)
        }
        break
      }

      case 'chat': {
        // Chat event: { state: 'delta'|'final', message: { role, content: [{type:'text', text:'...'}] }, sessionKey }
        const state = payload.state as string | undefined
        const sessionKey = payload.sessionKey as string | undefined
        const message = payload.message as { role?: string; content?: Array<{ type: string; text?: string }> } | undefined
        if (state === 'final' && message?.role === 'assistant') {
          // Extract full text from content blocks
          const fullText = message.content
            ?.filter(b => b.type === 'text' && b.text)
            .map(b => b.text)
            .join('') || ''
          if (fullText) {
            console.log(`[OpenClaw] chat.final [${sessionKey}]: "${fullText.slice(0, 100)}..." (${fullText.length} chars)`)
            this.handlers.forEach(h => h({
              type: 'message',
              payload: {
                role: 'agent',
                content: fullText,
                channel: 'home',
                streaming: false,
                sessionKey,
              },
            }))
          }
        }
        break
      }

      case 'presence':
        this.handlers.forEach(h => h({ type: 'status', payload }))
        break

      case 'tick':
        // Keepalive — no action needed
        break

      case 'shutdown':
        console.log('[OpenClaw] Gateway shutting down')
        this.handlers.forEach(h => h({ type: 'status', payload: { online: false } }))
        break

      default:
        // Forward unknown events as logs
        this.handlers.forEach(h => h({
          type: 'log',
          payload: { level: 'DEBUG', message: `Event: ${event}`, source: 'openclaw' },
        }))
    }
  }

  // --- Cost Circuit Breaker ---

  private trackUsage(inputTokens: number, outputTokens: number): void {
    // Reset daily counter if new day
    const today = new Date().toDateString()
    if (this.costs.lastReset !== today) {
      this.costs.todaySpend = 0
      this.costs.sessionTokensIn = 0
      this.costs.sessionTokensOut = 0
      this.costs.lastReset = today
    }

    this.costs.sessionTokensIn += inputTokens
    this.costs.sessionTokensOut += outputTokens

    // Estimate cost (Claude Sonnet 4.5 pricing: $3/1M in, $15/1M out)
    const costIn = (inputTokens / 1_000_000) * 3
    const costOut = (outputTokens / 1_000_000) * 15
    this.costs.todaySpend += costIn + costOut

    // CIRCUIT BREAKER: stop agent if daily limit exceeded
    if (this.costs.todaySpend >= this.costs.dailyLimit) {
      console.error(`[COST GUARD] Daily limit of $${this.costs.dailyLimit} reached ($${this.costs.todaySpend.toFixed(2)}). Blocking further requests.`)
      this.handlers.forEach(h => h({
        type: 'log',
        payload: {
          level: 'ERROR',
          message: `COST GUARD: Daily limit of $${this.costs.dailyLimit} reached. Agent paused.`,
          source: 'cost-guard',
        },
      }))
    }

    // Warn at 80%
    if (this.costs.todaySpend >= this.costs.dailyLimit * 0.8 && this.costs.todaySpend < this.costs.dailyLimit) {
      this.handlers.forEach(h => h({
        type: 'log',
        payload: {
          level: 'WARN',
          message: `Cost warning: $${this.costs.todaySpend.toFixed(2)} / $${this.costs.dailyLimit} (${((this.costs.todaySpend / this.costs.dailyLimit) * 100).toFixed(0)}%)`,
          source: 'cost-guard',
        },
      }))
    }
  }

  isCostLimitReached(): boolean {
    return this.costs.todaySpend >= this.costs.dailyLimit
  }

  // --- Commands ---

  sendCommand(text: string, channel?: string): string | null {
    // Cost guard check
    if (this.isCostLimitReached()) {
      this.handlers.forEach(h => h({
        type: 'message',
        payload: {
          role: 'agent',
          content: `**Cost limit reached.** Today's spend ($${this.costs.todaySpend.toFixed(2)}) has hit the daily limit ($${this.costs.dailyLimit}). Increase the limit in Settings to continue.`,
          channel: channel || 'home',
        },
      }))
      return null
    }

    if (!this.authenticated) {
      console.warn(`[OpenClaw] sendCommand dropped — not authenticated. text="${text.slice(0, 60)}"`)
      return null
    }
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn(`[OpenClaw] sendCommand dropped — ws not open (state=${this.ws?.readyState}). text="${text.slice(0, 60)}"`)
      return null
    }

    const reqId = this.nextId()
    const runId = crypto.randomUUID()
    const payload = {
      type: 'req',
      id: reqId,
      method: 'chat.send',
      params: {
        message: text,
        sessionKey: channel || 'main',
        deliver: false,
        idempotencyKey: runId,
      },
    }

    try {
      console.log(`[OpenClaw] sendCommand id=${reqId} runId=${runId} sessionKey="${channel || 'main'}" text="${text.slice(0, 80)}"`)
      this.send(payload)
      console.log(`[OpenClaw] sendCommand id=${reqId} sent OK`)
      return runId
    } catch (err) {
      console.error(`[OpenClaw] sendCommand id=${reqId} FAILED:`, err)
      return null
    }
  }

  sendHealthCheck(): void {
    if (!this.authenticated) return
    this.send({
      type: 'req',
      id: this.nextId(),
      method: 'health',
      params: {},
    })
  }

  // --- Transport ---

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data))
      } catch (err) {
        console.error('[OpenClaw] ws.send() threw:', err)
      }
    } else {
      console.warn(`[OpenClaw] send() dropped — ws not open (state=${this.ws?.readyState})`)
    }
  }

  private nextId(): string {
    return `az-${++this.requestId}`
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
      this.reconnectAttempts++
      this.connect()
    }, this.reconnectDelay)
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.connected = false
    this.authenticated = false
  }
}
