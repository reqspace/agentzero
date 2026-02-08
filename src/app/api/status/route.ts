import { NextResponse } from 'next/server'

export async function GET() {
  const clawClient = (global as Record<string, unknown>).clawClient as { connected: boolean } | undefined
  return NextResponse.json({
    online: clawClient?.connected || false,
    uptime: process.uptime(),
  })
}
