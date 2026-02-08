import { getDb } from './db'

type Turn = { role: 'caller' | 'agent'; content: string }

export async function generateVoiceResponse(turns: Turn[]): Promise<string> {
  const db = getDb()
  const apiKey = (db.prepare('SELECT value FROM settings WHERE key = ?').get('anthropic_key') as { value: string } | undefined)?.value
    || process.env.ANTHROPIC_API_KEY
    || ''

  if (!apiKey) {
    return "I'm sorry, I'm unable to process your request right now. Please try again later."
  }

  const messages = turns.map(t => ({
    role: t.role === 'caller' ? 'user' as const : 'assistant' as const,
    content: t.content,
  }))

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 300,
        system: 'You are Agent Zero, an AI assistant answering a phone call. Keep responses concise and conversational — this will be spoken aloud via text-to-speech. Avoid markdown, bullet points, or long lists. Respond naturally as if speaking on the phone. Limit responses to 2-3 sentences.',
        messages,
      }),
    })

    if (!res.ok) {
      console.error('[LLM] Anthropic API error:', res.status, await res.text())
      return "I'm having a bit of trouble processing that. Could you repeat your question?"
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    return text || "I'm sorry, could you say that again?"
  } catch (err) {
    console.error('[LLM] Error calling Anthropic:', err)
    return "I'm experiencing some technical difficulties. Please try calling back later."
  }
}
