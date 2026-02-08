'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { Button } from '@/components/ui/button'
import type { Setting } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Provider = {
  id: string
  name: string
  models: string
  color: string
  keyName: string
  icon: string
}

const providers: Provider[] = [
  { id: 'moonshot', name: 'Moonshot (Kimi)', models: 'Kimi K2.5, Kimi Coding — 6x cheaper than Claude', color: '#6c5ce7', keyName: 'moonshot_key', icon: 'K' },
  { id: 'anthropic', name: 'Anthropic', models: 'Claude Sonnet 4.5, Opus 4.6, Haiku', color: '#d4a27f', keyName: 'anthropic_key', icon: 'A' },
  { id: 'openai', name: 'OpenAI', models: 'GPT-4o, o1, o3-mini', color: '#10a37f', keyName: 'openai_key', icon: 'O' },
  { id: 'deepseek', name: 'DeepSeek', models: 'DeepSeek-V3, R1', color: '#4a6cf7', keyName: 'deepseek_key', icon: 'D' },
  { id: 'google', name: 'Google AI', models: 'Gemini 2.0, Flash', color: '#4285f4', keyName: 'google_key', icon: 'G' },
  { id: 'replicate', name: 'Replicate', models: 'Open source models', color: '#f97316', keyName: 'replicate_key', icon: 'R' },
  { id: 'groq', name: 'Groq', models: 'Llama 3, Mixtral (fast)', color: '#f55036', keyName: 'groq_key', icon: 'Q' },
  { id: 'together', name: 'Together AI', models: 'Open models cluster', color: '#6366f1', keyName: 'together_key', icon: 'T' },
]

export default function IntegrationsPage() {
  const { data: settings = [] } = useSWR<Setting[]>('/api/settings', fetcher)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value || ''
  const todaySpend = parseFloat(getSetting('today_spend') || '0')
  const dailyLimit = parseFloat(getSetting('daily_cost_limit') || '25')
  const spendPercent = Math.min((todaySpend / dailyLimit) * 100, 100)

  const handleSaveKey = async (keyName: string) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyName, value: keyInput, encrypted: 1 }),
    })
    setEditingKey(null)
    setKeyInput('')
    mutate('/api/settings')
  }

  const getStatus = (keyName: string): 'active' | 'inactive' | 'unconfigured' => {
    const val = getSetting(keyName)
    if (!val) return 'unconfigured'
    return 'active'
  }

  const statusConfig = {
    active: { label: 'Active', className: 'bg-teal/10 text-teal border-teal/20' },
    inactive: { label: 'Inactive', className: 'bg-warn/10 text-warn border-warn/20' },
    unconfigured: { label: 'Not configured', className: 'bg-bg-4 text-text-3 border-border' },
  }

  const maskKey = (key: string) => {
    if (!key) return '---'
    return key.slice(0, 8) + '•'.repeat(20) + key.slice(-4)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-text-1">Integrations</h1>
          <p className="text-text-3 text-sm mt-0.5">Manage LLM providers and API keys</p>
        </motion.div>

        {/* Spend Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-bg-2 border border-border rounded-2xl p-6 mb-6"
        >
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-text-3 text-sm mb-1">Today&apos;s Spend</p>
              <p className="text-4xl font-bold gradient-text">${todaySpend.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-text-3 text-sm">Daily Limit</p>
              <p className="text-xl font-semibold text-text-1">${dailyLimit.toFixed(2)}</p>
            </div>
          </div>
          <div className="h-2 bg-bg-4 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                spendPercent > 80 ? 'bg-gradient-to-r from-warn to-error' : 'bg-gradient-to-r from-orange to-pink'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${spendPercent}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <p className="text-text-3 text-xs mt-2">{spendPercent.toFixed(0)}% of daily limit used</p>
        </motion.div>

        {/* Provider cards */}
        <div className="space-y-3">
          {providers.map((provider, i) => {
            const status = getStatus(provider.keyName)
            const sc = statusConfig[status]
            const keyValue = getSetting(provider.keyName)
            const isRevealed = revealedKeys.has(provider.keyName)

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
                className="bg-bg-2 border border-border rounded-2xl p-4 card-hover"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: provider.color }}
                  >
                    {provider.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-1">{provider.name}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc.className}`}>
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-3 mt-0.5">{provider.models}</p>
                  </div>

                  {/* API Key */}
                  <div className="flex items-center gap-2">
                    {editingKey === provider.keyName ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={keyInput}
                          onChange={e => setKeyInput(e.target.value)}
                          placeholder="sk-..."
                          className="bg-bg-4 border border-border rounded-lg px-3 py-1.5 text-xs text-text-1 font-mono w-[280px] outline-none focus:border-border-hi"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => handleSaveKey(provider.keyName)}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        {keyValue && (
                          <button
                            onClick={() => {
                              setRevealedKeys(prev => {
                                const next = new Set(prev)
                                if (next.has(provider.keyName)) next.delete(provider.keyName)
                                else next.add(provider.keyName)
                                return next
                              })
                            }}
                            className="text-xs text-text-3 font-mono bg-bg-4 rounded-lg px-3 py-1.5 hover:text-text-2 transition-colors cursor-pointer max-w-[200px] truncate"
                          >
                            {isRevealed ? keyValue : maskKey(keyValue)}
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingKey(provider.keyName)
                            setKeyInput(keyValue)
                          }}
                        >
                          {keyValue ? 'Edit' : 'Configure'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
