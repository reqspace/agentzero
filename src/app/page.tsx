'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSocket } from '@/hooks/use-socket'
import type { Message, Conversation } from '@/lib/db'
import { formatTime } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const quickActions = [
  'Scrape competitor prices',
  'Triage my emails',
  'Generate weekly report',
  'Run overnight batch',
]

type ConversationWithPreview = Conversation & {
  last_message: string | null
  message_count: number
}

type SearchResult = Message & { conversation_title: string | null }

export default function HomePage() {
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchRole, setSearchRole] = useState<string>('')

  const { data: conversations = [] } = useSWR<ConversationWithPreview[]>('/api/conversations', fetcher)
  const messagesUrl = activeConversation
    ? `/api/messages?conversation_id=${activeConversation}`
    : '/api/messages'
  const { data: messages = [] } = useSWR<Message[]>(messagesUrl, fetcher)
  const { data: searchResults = [] } = useSWR<SearchResult[]>(
    showSearch && searchQuery.length >= 2
      ? `/api/search?q=${encodeURIComponent(searchQuery)}${searchRole ? `&role=${searchRole}` : ''}`
      : null,
    fetcher
  )

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { on, emit } = useSocket()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    const unsub = on('message', (data: unknown) => {
      const msg = data as { role: string; content: string; channel?: string; conversation_id?: string }
      if (!msg.channel || msg.channel === 'home') {
        mutate(messagesUrl)
        mutate('/api/conversations')
      }
    })
    return () => { unsub() }
  }, [on, messagesUrl])

  // Cmd+K shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(prev => !prev)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus()
  }, [showSearch])

  const createConversation = async () => {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const conv = await res.json()
    setActiveConversation(conv.id)
    mutate('/api/conversations')
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (activeConversation === id) setActiveConversation(null)
    mutate('/api/conversations')
  }

  const handleSend = async (text?: string) => {
    const content = text || input.trim()
    if (!content && files.length === 0) return
    setSending(true)
    setInput('')

    // Auto-create conversation if none active
    let convId = activeConversation
    if (!convId) {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: content.slice(0, 60) }),
      })
      const conv = await res.json()
      convId = conv.id
      setActiveConversation(convId)
      mutate('/api/conversations')
    }

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

    emit('command', { text: content, attachments, conversation_id: convId })
    mutate(messagesUrl)
    mutate('/api/conversations')
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

  const jumpToConversation = (convId: string | null) => {
    setActiveConversation(convId)
    setShowSearch(false)
    setSearchQuery('')
  }

  const isEmpty = messages.length === 0
  const activeConvTitle = conversations.find(c => c.id === activeConversation)?.title

  return (
    <div
      className="flex h-full"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Conversation sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-border bg-bg-1 flex flex-col overflow-hidden shrink-0"
          >
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-1">Chats</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSearch(true)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-bg-3 transition-colors cursor-pointer"
                  title="Search (Cmd+K)"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="7" cy="7" r="5" />
                    <path d="M11 11L14 14" />
                  </svg>
                </button>
                <button
                  onClick={createConversation}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-bg-3 transition-colors cursor-pointer"
                  title="New conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M8 3V13M3 8H13" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Legacy messages (no conversation) */}
              <button
                onClick={() => setActiveConversation(null)}
                className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer ${
                  activeConversation === null
                    ? 'bg-bg-2 border-l-[3px] border-l-orange'
                    : 'hover:bg-bg-2 border-l-[3px] border-l-transparent'
                }`}
              >
                <div className="text-sm font-medium text-text-1 truncate">All Messages</div>
                <div className="text-[11px] text-text-3 mt-0.5">Legacy chat history</div>
              </button>

              {conversations.map((conv, i) => (
                <motion.button
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setActiveConversation(conv.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors group cursor-pointer ${
                    activeConversation === conv.id
                      ? 'bg-bg-2 border-l-[3px] border-l-orange'
                      : 'hover:bg-bg-2 border-l-[3px] border-l-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-1 truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => deleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-text-3 hover:text-error transition-all cursor-pointer shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2L10 10M10 2L2 10" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[11px] text-text-3 truncate flex-1">
                      {conv.last_message?.slice(0, 50) || 'Empty conversation'}
                    </span>
                    <span className="text-[10px] text-text-3 shrink-0 ml-2">{formatTime(conv.updated_at)}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidebar(p => !p)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-text-2 hover:bg-bg-3 transition-colors cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4H14M2 8H14M2 12H14" />
              </svg>
            </button>
            <h2 className="text-sm font-medium text-text-1 truncate">
              {activeConvTitle || 'Agent Zero'}
            </h2>
          </div>
          <button
            onClick={() => setShowSearch(true)}
            className="text-[11px] text-text-3 bg-bg-2 border border-border rounded-lg px-2.5 py-1 hover:border-border-hi transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11L14 14" />
            </svg>
            Search
            <kbd className="text-[10px] text-text-3 bg-bg-3 rounded px-1">&#8984;K</kbd>
          </button>
        </div>

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
                <div className="text-4xl mb-3">+</div>
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
                                {f.split('/').pop()}
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
                  {f.name}
                  <button
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                    className="text-text-3 hover:text-error ml-0.5 cursor-pointer"
                  >
                    x
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
              disabled={(!input.trim() && files.length === 0) || sending}
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

      {/* Search overlay */}
      <AnimatePresence>
        {showSearch && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-bg-0/70 backdrop-blur-sm"
              onClick={() => setShowSearch(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[560px] max-h-[60vh] bg-bg-2 border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-3 shrink-0">
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11L14 14" />
                </svg>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="flex-1 bg-transparent text-sm text-text-1 placeholder:text-text-3 outline-none"
                />
                <select
                  value={searchRole}
                  onChange={e => setSearchRole(e.target.value)}
                  className="text-xs bg-bg-3 border border-border rounded-lg px-2 py-1 text-text-2 outline-none cursor-pointer"
                >
                  <option value="">All roles</option>
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                </select>
                <kbd
                  onClick={() => setShowSearch(false)}
                  className="text-[10px] text-text-3 bg-bg-3 border border-border rounded px-1.5 py-0.5 cursor-pointer hover:bg-bg-4"
                >
                  ESC
                </kbd>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[400px]">
                {searchQuery.length < 2 ? (
                  <div className="p-8 text-center text-text-3 text-sm">
                    Type at least 2 characters to search
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-text-3 text-sm">
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="p-2">
                    {searchResults.map(result => (
                      <button
                        key={result.id}
                        onClick={() => jumpToConversation(result.conversation_id)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-bg-3 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            result.role === 'user' ? 'bg-orange/10 text-orange' : 'bg-teal/10 text-teal'
                          }`}>
                            {result.role}
                          </span>
                          <span className="text-[10px] text-text-3">
                            {result.conversation_title || 'Legacy chat'}
                          </span>
                          <span className="text-[10px] text-text-3 ml-auto">
                            {formatTime(result.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-text-2 line-clamp-2">{result.content}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
