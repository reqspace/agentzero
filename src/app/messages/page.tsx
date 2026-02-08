'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { useSocket } from '@/hooks/use-socket'
import { formatTime } from '@/lib/utils'
import type { Channel, ChannelMessage } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const channelIcons: Record<string, string> = {
  whatsapp: 'M12 2C6.48 2 2 6.48 2 12C2 13.85 2.5 15.55 3.36 17L2 22L7.14 20.68C8.55 21.51 10.22 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z',
  telegram: 'M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8L15.18 15.65C15.07 16.13 14.78 16.26 14.38 16.04L11.93 14.23L10.75 15.37C10.63 15.49 10.53 15.59 10.28 15.59L10.44 13.09L14.87 9.06C15.08 8.87 14.83 8.76 14.56 8.95L9.08 12.4L6.66 11.65C6.19 11.49 6.18 11.16 6.76 10.94L16 8.29C16.39 8.16 16.74 8.4 16.64 8.8Z',
  slack: 'M5.04 15.56C5.04 16.59 4.2 17.43 3.17 17.43C2.14 17.43 1.3 16.59 1.3 15.56C1.3 14.53 2.14 13.69 3.17 13.69H5.04V15.56ZM5.98 15.56C5.98 14.53 6.82 13.69 7.85 13.69C8.88 13.69 9.72 14.53 9.72 15.56V20.83C9.72 21.86 8.88 22.7 7.85 22.7C6.82 22.7 5.98 21.86 5.98 20.83V15.56Z',
  signal: 'M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z',
  discord: 'M20.32 4.37C18.79 3.66 17.15 3.14 15.43 2.86C15.23 3.22 15 3.7 14.85 4.08C13.03 3.82 11.23 3.82 9.44 4.08C9.29 3.7 9.05 3.22 8.85 2.86C7.13 3.14 5.49 3.66 3.96 4.37C0.76 9.2 -0.1 13.9 0.32 18.53C2.35 20.01 4.31 20.9 6.24 21.49C6.68 20.9 7.07 20.27 7.41 19.6C6.78 19.36 6.18 19.06 5.61 18.72C5.76 18.61 5.91 18.5 6.05 18.38C10.13 20.25 14.61 20.25 18.65 18.38C18.8 18.5 18.95 18.61 19.1 18.72C18.52 19.06 17.92 19.36 17.3 19.6C17.64 20.27 18.03 20.9 18.47 21.49C20.4 20.9 22.36 20.01 24.39 18.53C24.89 13.18 23.51 8.52 20.32 4.37Z',
  webchat: 'M4 4H20C21 4 22 5 22 6V16C22 17 21 18 20 18H12L8 22V18H4C3 18 2 17 2 16V6C2 5 3 4 4 4Z',
}

export default function MessagesPage() {
  const { data: channels = [] } = useSWR<Channel[]>('/api/channels', fetcher)
  const [activeChannel, setActiveChannel] = useState<string>('whatsapp')
  const { data: messages = [] } = useSWR<ChannelMessage[]>(
    activeChannel ? `/api/channels/${activeChannel}/messages` : null,
    fetcher
  )
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { on } = useSocket()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const unsub = on('message', (data: unknown) => {
      const msg = data as { channel?: string }
      if (msg.channel === activeChannel) {
        mutate(`/api/channels/${activeChannel}/messages`)
      }
      mutate('/api/channels')
    })
    return () => { unsub() }
  }, [on, activeChannel])

  const handleSend = async () => {
    if (!input.trim()) return
    const text = input
    setInput('')
    await fetch(`/api/channels/${activeChannel}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, role: 'user' }),
    })
    mutate(`/api/channels/${activeChannel}/messages`)
  }

  const activeChannelData = channels.find(c => c.id === activeChannel)

  return (
    <div className="h-full flex">
      {/* Channel list */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-[300px] border-r border-border bg-bg-1 flex flex-col"
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-text-1">Messages</h1>
          <p className="text-text-3 text-xs mt-0.5">{channels.length} channels</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channels.map((channel, i) => {
            const isActive = channel.id === activeChannel
            const lastMsg = channel.last_message_at
            return (
              <motion.button
                key={channel.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setActiveChannel(channel.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer
                  ${isActive
                    ? 'bg-bg-2 border-l-[3px] border-l-orange'
                    : 'hover:bg-bg-2 border-l-[3px] border-l-transparent'
                  }
                `}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: channel.color + '20' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={channel.color || '#fff'}>
                    <path d={channelIcons[channel.type] || channelIcons.webchat} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-1">{channel.name}</span>
                    {lastMsg && (
                      <span className="text-[10px] text-text-3">{formatTime(lastMsg)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-text-3 truncate">
                      {channel.status === 'connected' ? 'Connected' : 'Offline'}
                    </span>
                    {channel.unread_count > 0 && (
                      <span className="bg-pink text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {channel.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Chat view */}
      <div className="flex-1 flex flex-col">
        {activeChannelData ? (
          <>
            {/* Chat header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: activeChannelData.color + '20' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={activeChannelData.color || '#fff'}>
                    <path d={channelIcons[activeChannelData.type] || channelIcons.webchat} />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-1">{activeChannelData.name}</h2>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      activeChannelData.status === 'connected' ? 'bg-teal' : 'bg-text-3'
                    }`} />
                    <span className="text-[10px] text-text-3 capitalize">{activeChannelData.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-[700px] mx-auto space-y-3">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`
                        max-w-[75%] rounded-2xl px-4 py-2.5 text-sm
                        ${msg.role === 'user'
                          ? 'bg-gradient-to-br from-orange to-pink text-white'
                          : 'bg-bg-2 border border-border text-text-1'
                        }
                      `}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.role === 'user' ? 'text-white/60' : 'text-text-3'
                        }`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <div className="max-w-[700px] mx-auto flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                  placeholder={`Message ${activeChannelData.name}...`}
                  className="flex-1 bg-bg-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text-1 placeholder:text-text-3 outline-none focus:border-border-hi"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`
                    px-4 rounded-xl transition-all cursor-pointer
                    ${input.trim() ? 'gradient-btn text-white' : 'bg-bg-3 text-text-3'}
                  `}
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9L15 3L9 15L8 10L3 9Z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-3">
            Select a channel
          </div>
        )}
      </div>
    </div>
  )
}
