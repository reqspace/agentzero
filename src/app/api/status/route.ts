import { NextResponse } from 'next/server'

export async function GET() {
  const clawClient = (global as Record<string, unknown>).clawClient as { authenticated: boolean } | undefined
  return NextResponse.json({
    online: clawClient?.authenticated || false,
    uptime: process.uptime(),
  })
}
