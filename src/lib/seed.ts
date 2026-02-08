import type Database from 'better-sqlite3'

export function seedDatabase(db: Database.Database) {
  // Settings — essential config only
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )
  const settings: [string, string][] = [
    ['primary_model', 'moonshot/kimi-k2.5'],
    ['fallback_model', 'claude-sonnet-4-5'],
    ['moonshot_key', ''],
    ['anthropic_key', ''],
    ['openai_key', ''],
    ['deepseek_key', ''],
    ['google_key', ''],
    ['replicate_key', ''],
    ['groq_key', ''],
    ['together_key', ''],
    ['daily_cost_limit', '5.00'],
    ['overnight_enabled', 'false'],
    ['sleep_start', '23:00'],
    ['sleep_end', '07:00'],
    ['wake_on_urgent', 'true'],
    ['max_overnight_spend', '5.00'],
    ['gateway_address', 'wss://openclaw-production-281e.up.railway.app'],
    ['lane_mode', 'serial'],
    ['sandbox_mode', 'true'],
    ['require_confirmation', 'true'],
    ['push_enabled', 'true'],
    ['whatsapp_alerts', 'false'],
    ['telegram_alerts', 'false'],
    ['email_digest', 'false'],
    ['today_spend', '0'],
    ['telnyx_api_key', ''],
    ['telnyx_voice_enabled', 'false'],
    ['telnyx_phone_number', ''],
    ['telnyx_voice_greeting', 'Hello, you have reached Agent Zero. How can I help you?'],
  ]
  for (const [key, value] of settings) insertSetting.run(key, value)

  // Channels — structure only, no fake messages
  const insertChannel = db.prepare(
    'INSERT OR IGNORE INTO channels (id, name, type, color, enabled, status, unread_count) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const channels: [string, string, string, string, number, string, number][] = [
    ['whatsapp', 'WhatsApp', 'whatsapp', '#25d366', 0, 'disconnected', 0],
    ['telegram', 'Telegram', 'telegram', '#0088cc', 0, 'disconnected', 0],
    ['slack', 'Slack', 'slack', '#e8a820', 0, 'disconnected', 0],
    ['signal', 'Signal', 'signal', '#3b76f0', 0, 'disconnected', 0],
    ['discord', 'Discord', 'discord', '#5865f2', 0, 'disconnected', 0],
    ['webchat', 'WebChat', 'webchat', '#ff6b35', 0, 'disconnected', 0],
  ]
  for (const c of channels) insertChannel.run(...c)

  // Initial log entry
  db.prepare(
    'INSERT INTO logs (level, message, source) VALUES (?, ?, ?)'
  ).run('INFO', 'Agent Zero Mission Control initialized', 'system')
}
