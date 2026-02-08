import { getDb } from './db'
import type { Contact } from './db'
import crypto from 'crypto'

export function getOrCreateContact(phoneNumber: string, interactionType: 'sms' | 'voice' = 'sms'): Contact {
  const db = getDb()

  const existing = db.prepare('SELECT * FROM contacts WHERE phone_number = ?').get(phoneNumber) as Contact | undefined
  if (existing) {
    // Update type to 'both' if this is a new interaction type
    if (existing.type !== 'both' && existing.type !== interactionType) {
      db.prepare('UPDATE contacts SET type = ? WHERE id = ?').run('both', existing.id)
      existing.type = 'both'
    }
    db.prepare('UPDATE contacts SET last_interaction_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.id)
    return existing
  }

  const id = crypto.randomBytes(8).toString('hex')
  db.prepare(
    'INSERT INTO contacts (id, phone_number, type, last_interaction_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
  ).run(id, phoneNumber, interactionType)

  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Contact
}

export function incrementUnread(contactId: string) {
  const db = getDb()
  db.prepare('UPDATE contacts SET unread_count = unread_count + 1 WHERE id = ?').run(contactId)
}

export function clearUnread(contactId: string) {
  const db = getDb()
  db.prepare('UPDATE contacts SET unread_count = 0 WHERE id = ?').run(contactId)
}
