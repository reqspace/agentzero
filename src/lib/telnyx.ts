import { getDb } from './db'

const TELNYX_API_BASE = 'https://api.telnyx.com/v2'

function getApiKey(): string {
  // Env var takes priority, then DB setting
  if (process.env.TELNYX_API_KEY) return process.env.TELNYX_API_KEY
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('telnyx_api_key') as { value: string } | undefined
  return row?.value || ''
}

async function telnyxRequest(path: string, body: Record<string, unknown> = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Telnyx API key not configured')

  const res = await fetch(`${TELNYX_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telnyx API error ${res.status}: ${text}`)
  }

  return res.json()
}

export async function answerCall(callControlId: string, clientState?: string) {
  return telnyxRequest(`/calls/${callControlId}/actions/answer`, {
    client_state: clientState ? Buffer.from(clientState).toString('base64') : undefined,
  })
}

export async function gatherUsingSpeak(
  callControlId: string,
  text: string,
  opts: { voice?: string; language?: string; timeoutSecs?: number } = {}
) {
  return telnyxRequest(`/calls/${callControlId}/actions/gather_using_speak`, {
    payload: text,
    voice: opts.voice || 'female',
    language: opts.language || 'en-US',
    minimum_digits: 0,
    maximum_digits: 0,
    inter_digit_timeout_secs: 3,
    timeout_secs: opts.timeoutSecs || 15,
  })
}

export async function speak(
  callControlId: string,
  text: string,
  opts: { voice?: string; language?: string } = {}
) {
  return telnyxRequest(`/calls/${callControlId}/actions/speak`, {
    payload: text,
    voice: opts.voice || 'female',
    language: opts.language || 'en-US',
  })
}

export async function hangupCall(callControlId: string) {
  return telnyxRequest(`/calls/${callControlId}/actions/hangup`, {})
}

export async function sendSms(to: string, text: string) {
  const db = getDb()
  const from = process.env.TELNYX_PHONE_NUMBER || (db.prepare('SELECT value FROM settings WHERE key = ?').get('telnyx_phone_number') as { value: string } | undefined)?.value
  if (!from) throw new Error('Telnyx phone number not configured')

  return telnyxRequest('/messages', {
    from,
    to,
    text,
    type: 'SMS',
  })
}

export function isVoiceEnabled(): boolean {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('telnyx_voice_enabled') as { value: string } | undefined
  return row?.value === 'true'
}

export function getGreeting(): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('telnyx_voice_greeting') as { value: string } | undefined
  return row?.value || 'Hello, you have reached Agent Zero. How can I help you?'
}
