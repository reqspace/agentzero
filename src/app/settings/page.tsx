'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { Switch } from '@/components/ui/switch'
import type { Setting } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function SettingsPage() {
  const { data: settings = [] } = useSWR<Setting[]>('/api/settings', fetcher)
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    const map: Record<string, string> = {}
    settings.forEach(s => { map[s.key] = s.value })
    setLocalSettings(map)
  }, [settings])

  const get = (key: string) => localSettings[key] || ''
  const getBool = (key: string) => get(key) === 'true'

  const updateSetting = async (key: string, value: string) => {
    setLocalSettings(p => ({ ...p, [key]: value }))
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    mutate('/api/settings')
  }

  const toggleSetting = (key: string) => {
    updateSetting(key, getBool(key) ? 'false' : 'true')
  }

  const sections = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="9" cy="9" r="7" />
          <path d="M9 5V9L12 12" />
        </svg>
      ),
      title: 'Autonomous Mode',
      description: 'Configure overnight and autonomous processing',
      rows: [
        {
          label: 'Overnight Processing',
          desc: 'Allow the agent to run tasks while you sleep',
          control: (
            <Switch
              checked={getBool('overnight_enabled')}
              onCheckedChange={() => toggleSetting('overnight_enabled')}
            />
          ),
        },
        {
          label: 'Sleep Window',
          desc: 'When overnight processing is active',
          control: (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={get('sleep_start')}
                onChange={e => updateSetting('sleep_start', e.target.value)}
                className="bg-bg-4 border border-border rounded-lg px-2 py-1 text-xs text-text-1 outline-none focus:border-border-hi [color-scheme:dark]"
              />
              <span className="text-text-3 text-xs">to</span>
              <input
                type="time"
                value={get('sleep_end')}
                onChange={e => updateSetting('sleep_end', e.target.value)}
                className="bg-bg-4 border border-border rounded-lg px-2 py-1 text-xs text-text-1 outline-none focus:border-border-hi [color-scheme:dark]"
              />
            </div>
          ),
        },
        {
          label: 'Wake on Urgent',
          desc: 'Wake up for urgent tasks even during sleep window',
          control: (
            <Switch
              checked={getBool('wake_on_urgent')}
              onCheckedChange={() => toggleSetting('wake_on_urgent')}
            />
          ),
        },
        {
          label: 'Max Overnight Spend',
          desc: 'Maximum API cost during overnight processing',
          control: (
            <div className="flex items-center gap-1">
              <span className="text-text-3 text-sm">$</span>
              <input
                type="number"
                step="1"
                value={get('max_overnight_spend')}
                onChange={e => updateSetting('max_overnight_spend', e.target.value)}
                className="bg-bg-4 border border-border rounded-lg px-2 py-1 text-xs text-text-1 outline-none focus:border-border-hi w-20 text-right"
              />
            </div>
          ),
        },
      ],
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="8" width="12" height="8" rx="2" />
          <path d="M6 8V5C6 3.34 7.34 2 9 2C10.66 2 12 3.34 12 5V8" />
          <circle cx="9" cy="12" r="1" fill="currentColor" />
        </svg>
      ),
      title: 'Security',
      description: 'Safety and access controls',
      rows: [
        {
          label: 'Require Confirmation',
          desc: 'Ask before executing potentially dangerous actions',
          control: (
            <Switch
              checked={getBool('require_confirmation')}
              onCheckedChange={() => toggleSetting('require_confirmation')}
            />
          ),
        },
        {
          label: 'Sandbox Mode',
          desc: 'Run agent actions in an isolated sandbox environment',
          control: (
            <Switch
              checked={getBool('sandbox_mode')}
              onCheckedChange={() => toggleSetting('sandbox_mode')}
            />
          ),
        },
      ],
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M14 3V1M14 3L12.5 4.5M14 3L15.5 4.5" />
          <path d="M3 13C3 13 5 10 9 10C13 10 15 13 15 13" />
          <path d="M3 9C3 9 5 6 9 6C13 6 15 9 15 9" />
          <path d="M5 5.5C5 5.5 6.5 3 9 3" />
        </svg>
      ),
      title: 'Notifications',
      description: 'How you get notified about agent activity',
      rows: [
        {
          label: 'Push Notifications',
          desc: 'Browser and mobile push notifications',
          control: (
            <Switch
              checked={getBool('push_enabled')}
              onCheckedChange={() => toggleSetting('push_enabled')}
            />
          ),
        },
        {
          label: 'WhatsApp Alerts',
          desc: 'Receive alerts via WhatsApp',
          control: (
            <Switch
              checked={getBool('whatsapp_alerts')}
              onCheckedChange={() => toggleSetting('whatsapp_alerts')}
            />
          ),
        },
        {
          label: 'Telegram Alerts',
          desc: 'Receive alerts via Telegram',
          control: (
            <Switch
              checked={getBool('telegram_alerts')}
              onCheckedChange={() => toggleSetting('telegram_alerts')}
            />
          ),
        },
        {
          label: 'Email Digest',
          desc: 'Daily summary email of all agent activity',
          control: (
            <Switch
              checked={getBool('email_digest')}
              onCheckedChange={() => toggleSetting('email_digest')}
            />
          ),
        },
      ],
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 5C3 3.9 3.9 3 5 3H6.5L8.5 7L7 8C7.8 9.9 8.1 10.2 10 11L11 9.5L15 11.5V13C15 14.1 14.1 15 13 15C7 15 3 11 3 5Z" />
        </svg>
      ),
      title: 'Telephony',
      description: 'Telnyx voice calls and SMS configuration',
      rows: [
        {
          label: 'Telnyx API Key',
          desc: 'API key from your Telnyx portal',
          control: (
            <input
              type="password"
              value={get('telnyx_api_key')}
              onChange={e => updateSetting('telnyx_api_key', e.target.value)}
              placeholder="KEYxxxxxxxx"
              className="bg-bg-4 border border-border rounded-lg px-3 py-1 text-xs text-text-1 font-mono outline-none focus:border-border-hi w-56"
            />
          ),
        },
        {
          label: 'Phone Number',
          desc: 'Your Telnyx phone number for receiving calls/SMS',
          control: (
            <input
              value={get('telnyx_phone_number')}
              onChange={e => updateSetting('telnyx_phone_number', e.target.value)}
              placeholder="+1XXXXXXXXXX"
              className="bg-bg-4 border border-border rounded-lg px-3 py-1 text-xs text-text-1 font-mono outline-none focus:border-border-hi w-44"
            />
          ),
        },
        {
          label: 'Voice Auto-Answer',
          desc: 'Agent Zero answers incoming calls with AI',
          control: (
            <Switch
              checked={getBool('telnyx_voice_enabled')}
              onCheckedChange={() => toggleSetting('telnyx_voice_enabled')}
            />
          ),
        },
        {
          label: 'Greeting Message',
          desc: 'What Agent Zero says when answering a call',
          control: (
            <input
              value={get('telnyx_voice_greeting')}
              onChange={e => updateSetting('telnyx_voice_greeting', e.target.value)}
              className="bg-bg-4 border border-border rounded-lg px-3 py-1 text-xs text-text-1 outline-none focus:border-border-hi w-72"
            />
          ),
        },
      ],
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="3" width="14" height="12" rx="2" />
          <path d="M6 8L8 10L6 12" />
          <path d="M10 12H13" />
        </svg>
      ),
      title: 'Gateway',
      description: 'OpenClaw gateway connection settings',
      rows: [
        {
          label: 'Gateway Address',
          desc: 'WebSocket URL for the OpenClaw gateway',
          control: (
            <input
              value={get('gateway_address')}
              onChange={e => updateSetting('gateway_address', e.target.value)}
              className="bg-bg-4 border border-border rounded-lg px-3 py-1 text-xs text-text-1 font-mono outline-none focus:border-border-hi w-56"
            />
          ),
        },
        {
          label: 'Lane Mode',
          desc: 'How tasks are executed in the gateway',
          control: (
            <select
              value={get('lane_mode')}
              onChange={e => updateSetting('lane_mode', e.target.value)}
              className="bg-bg-4 border border-border rounded-lg px-3 py-1 text-xs text-text-1 outline-none focus:border-border-hi cursor-pointer"
            >
              <option value="serial">Serial</option>
              <option value="parallel">Parallel</option>
              <option value="hybrid">Hybrid</option>
            </select>
          ),
        },
      ],
    },
  ]

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-[700px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-text-1">Settings</h1>
          <p className="text-text-3 text-sm mt-0.5">Configure Agent Zero behavior</p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-5">
          {sections.map((section, si) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.05 }}
              className="bg-bg-2 border border-border rounded-2xl overflow-hidden"
            >
              {/* Section header */}
              <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                <div className="text-text-2">{section.icon}</div>
                <div>
                  <h2 className="text-sm font-semibold text-text-1">{section.title}</h2>
                  <p className="text-[11px] text-text-3">{section.description}</p>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border">
                {section.rows.map((row, ri) => (
                  <div key={ri} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-text-1">{row.label}</p>
                      <p className="text-[11px] text-text-3 mt-0.5">{row.desc}</p>
                    </div>
                    {row.control}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
