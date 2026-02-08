import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: Request) {
  const db = getDb()
  const { text, attachments, channel = 'home', conversation_id } = await request.json()

  // Store user message
  const userMsgId = crypto.randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO messages (id, role, content, channel, attachments, conversation_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userMsgId, 'user', text, channel, attachments ? JSON.stringify(attachments) : null, conversation_id || null)

  // Update conversation timestamp if provided
  if (conversation_id) {
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversation_id)
  }

  // Forward to OpenClaw gateway
  const clawClient = (global as Record<string, unknown>).clawClient as { sendCommand: (t: string, c?: string) => void; authenticated: boolean } | undefined
  if (clawClient?.authenticated) {
    clawClient.sendCommand(text, channel)
  } else {
    // Simulate agent response when gateway is not connected
    const agentMsgId = crypto.randomBytes(8).toString('hex')
    const response = generateSimulatedResponse(text)
    db.prepare(
      'INSERT INTO messages (id, role, content, channel, conversation_id) VALUES (?, ?, ?, ?, ?)'
    ).run(agentMsgId, 'agent', response, channel, conversation_id || null)

    // Emit via Socket.IO
    const io = (global as Record<string, unknown>).io as { emit: (e: string, d: unknown) => void } | undefined
    io?.emit('message', { role: 'agent', content: response, channel, conversation_id })
  }

  return NextResponse.json({ ok: true })
}

function generateSimulatedResponse(text: string): string {
  const lower = text.toLowerCase()

  if (lower.includes('scrape') || lower.includes('competitor')) {
    return "I'll start scraping competitor data now. This typically takes 5-10 minutes depending on the number of sources.\n\n**Plan:**\n1. Connect to configured competitor URLs\n2. Extract pricing data\n3. Compare with our current prices\n4. Generate comparison report\n\nI'll notify you when it's complete."
  }

  if (lower.includes('email') || lower.includes('triage')) {
    return "Starting email triage. I'll classify incoming emails by:\n\n- **Priority**: Urgent, Normal, Low\n- **Category**: Support, Sales, Billing, Feedback\n- **Action**: Reply needed, FYI only, Escalate\n\nProcessing the queue now..."
  }

  if (lower.includes('report') || lower.includes('weekly')) {
    return "Generating the weekly report. I'll compile data from:\n\n- API usage metrics\n- Task completion rates\n- Cost breakdown by provider\n- Error rates and patterns\n\nThe report will be ready in approximately 3 minutes."
  }

  if (lower.includes('deploy') || lower.includes('staging')) {
    return "Initiating deployment sequence:\n\n```\n1. Running test suite...\n2. Building production bundle...\n3. Deploying to staging...\n```\n\nI'll run the full test suite first to ensure everything passes."
  }

  return `Understood. I'll work on this task: "${text}"\n\nI'm analyzing the best approach and will keep you updated on progress. You can check the **Tasks** tab for real-time status updates.`
}
