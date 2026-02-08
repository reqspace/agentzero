import Database from 'better-sqlite3'
import path from 'path'
import { seedDatabase } from './seed'

const DB_PATH = path.join(process.cwd(), 'data', 'agentzero.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  const fs = require('fs')
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const isNew = !fs.existsSync(DB_PATH)
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  initSchema(_db)
  if (isNew) seedDatabase(_db)

  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      role TEXT CHECK(role IN ('user','agent','system')) NOT NULL,
      content TEXT NOT NULL,
      channel TEXT DEFAULT 'home',
      attachments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('backlog','running','review','done','failed')) DEFAULT 'backlog',
      priority TEXT CHECK(priority IN ('high','med','low')) DEFAULT 'med',
      skill TEXT,
      progress INTEGER DEFAULT 0,
      tags TEXT,
      column_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT,
      enabled INTEGER DEFAULT 0,
      last_message_at DATETIME,
      status TEXT DEFAULT 'disconnected',
      unread_count INTEGER DEFAULT 0,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS channel_messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      channel_id TEXT REFERENCES channels(id),
      role TEXT CHECK(role IN ('user','agent')) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      type TEXT CHECK(type IN ('alert','task','info','system')) DEFAULT 'info',
      title TEXT NOT NULL,
      body TEXT,
      icon TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      level TEXT CHECK(level IN ('DEBUG','INFO','WARN','ERROR')) DEFAULT 'INFO',
      message TEXT NOT NULL,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      encrypted INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      version TEXT,
      category TEXT,
      active INTEGER DEFAULT 1,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      keys TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export type Message = {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  channel: string
  attachments: string | null
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: 'backlog' | 'running' | 'review' | 'done' | 'failed'
  priority: 'high' | 'med' | 'low'
  skill: string | null
  progress: number
  tags: string | null
  column_order: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type Channel = {
  id: string
  name: string
  type: string
  config: string | null
  enabled: number
  last_message_at: string | null
  status: string
  unread_count: number
  color: string | null
}

export type ChannelMessage = {
  id: string
  channel_id: string
  role: 'user' | 'agent'
  content: string
  created_at: string
}

export type LogEntry = {
  id: number
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  source: string | null
}

export type Skill = {
  id: string
  name: string
  icon: string | null
  description: string | null
  version: string | null
  category: string | null
  active: number
  installed_at: string
}

export type Setting = {
  key: string
  value: string
  encrypted: number
  updated_at: string
}
