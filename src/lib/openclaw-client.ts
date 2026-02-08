import WebSocket from 'ws'

type MessageHandler = (data: { type: string; payload: unknown }) => void

export class OpenClawClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private reconnectAttempts = 0
  private handlers: MessageHandler[] = []
  public connected = false

  constructor(private gatewayUrl: string) {}

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler)
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.gatewayUrl)

      this.ws.on('open', () => {
        this.connected = true
        this.reconnectDelay = 1000
        console.log(`[OpenClaw] Connected to gateway: ${this.gatewayUrl}`)
      })

      this.ws.on('close', () => {
        this.connected = false
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
          const data = JSON.parse(raw.toString())
          this.handlers.forEach(h => h(data))
        } catch {
          // ignore parse errors
        }
      })
    } catch {
      this.scheduleReconnect()
    }
  }

  sendCommand(text: string, channel?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'command', payload: { text, channel } }))
    }
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
  }
}
