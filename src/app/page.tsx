'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSocket } from '@/hooks/use-socket'
import type { Message } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const quickActions = [
  'Scrape competitor prices',
  'Triage my emails',
  'Generate weekly report',
  'Run overnight batch',
]

export default function HomePage() {
  const { data: messages = [] } = useSWR<Message[]>('/api/messages', fetcher)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { on } = useSocket()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    const unsub = on('message', (data: unknown) => {
      const msg = data as { role: string; content: string; channel?: string }
      if (!msg.channel || msg.channel === 'home') {
        mutate('/api/messages')
      }
    })
    return () => { unsub() }
  }, [on])

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content && files.length === 0) return
    setSending(true)
    setInput('')

    // Upload files first
    let attachments: string[] = []
    if (files.length > 0) {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        attachments = data.paths || []
      } catch {}
      setFiles([])
    }

    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, attachments }),
      })
      mutate('/api/messages')
    } catch {}
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => [...prev, ...dropped])
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 200) + 'px'
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-bg-0/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="border-2 border-dashed border-orange/50 rounded-2xl p-16 text-center">
              <div className="text-4xl mb-3">📎</div>
              <div className="text-text-1 font-medium">Drop files here</div>
              <div className="text-text-3 text-sm mt-1">Files will be sent to the agent</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[740px] mx-auto px-4 py-6 pb-4">
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-bold text-white mx-auto" style={{ background: 'linear-gradient(135deg, #00ddb3, #0088cc)' }}>Z</div>
              <h1 className="text-4xl font-bold gradient-text mb-3">
                What should I work on?
              </h1>
              <p className="text-text-3 text-lg mb-8 max-w-md">
                I&apos;m your always-on AI agent. Give me a task and I&apos;ll handle it autonomously.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map((action) => (
                  <motion.button
                    key={action}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSend(action)}
                    className="px-4 py-2 rounded-full bg-bg-2 border border-border text-text-2 text-sm hover:border-border-hi hover:text-text-1 transition-all cursor-pointer"
                  >
                    {action}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'agent' && (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1" style={{ background: 'linear-gradient(135deg, #00ddb3, #0088cc)' }}>
                        Z
                      </div>
                    )}
                    <div
                      className={`
                        max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-gradient-to-br from-orange to-pink text-white'
                          : 'bg-bg-2 border border-border text-text-1'
                        }
                      `}
                    >
                      {msg.role === 'agent' ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      {msg.attachments && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {JSON.parse(msg.attachments).map((f: string, j: number) => (
                            <span key={j} className="text-xs bg-white/10 rounded px-2 py-0.5">
                              📎 {f.split('/').pop()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-lg bg-bg-3 flex items-center justify-center text-xs font-semibold text-text-2 shrink-0 mt-1">
                        ML
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="max-w-[740px] mx-auto w-full px-4 pb-4 md:pb-6">
        {/* File chips */}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {files.map((f, i) => (
              <span
                key={i}
                className="text-xs bg-bg-3 border border-border rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-text-2"
              >
                📎 {f.name}
                <button
                  onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                  className="text-text-3 hover:text-error ml-0.5 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="bg-bg-2 border border-border rounded-[20px] flex items-end gap-2 px-3 py-2 focus-within:border-border-hi transition-colors">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-text-3 hover:text-text-2 transition-colors shrink-0 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M15.5 9.5L9.3 15.7C7.5 17.5 4.5 17.5 2.7 15.7C0.9 13.9 0.9 10.9 2.7 9.1L10.1 1.7C11.3 0.5 13.3 0.5 14.5 1.7C15.7 2.9 15.7 4.9 14.5 6.1L7.5 13.1C6.9 13.7 5.9 13.7 5.3 13.1C4.7 12.5 4.7 11.5 5.3 10.9L11 5.2" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
            }}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize() }}
            onKeyDown={handleKeyDown}
            placeholder="Message Agent Zero..."
            rows={1}
            className="flex-1 bg-transparent text-text-1 placeholder:text-text-3 resize-none py-2 text-sm outline-none max-h-[200px]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() && files.length === 0}
            className={`
              p-2 rounded-xl shrink-0 transition-all cursor-pointer
              ${input.trim() || files.length > 0
                ? 'gradient-btn text-white'
                : 'text-text-3 bg-bg-3'
              }
            `}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9L15 3L9 15L8 10L3 9Z" />
            </svg>
          </button>
        </div>

        <p className="text-center text-text-3 text-xs mt-2.5">
          Agent Zero can make mistakes. Always review autonomous actions.
        </p>
      </div>
    </div>
  )
}
