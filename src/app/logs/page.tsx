'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { useSocket } from '@/hooks/use-socket'
import { Button } from '@/components/ui/button'
import type { LogEntry } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const levelColors: Record<string, { text: string; bg: string }> = {
  DEBUG: { text: 'text-text-3', bg: 'bg-text-3/10' },
  INFO: { text: 'text-teal', bg: 'bg-teal/10' },
  WARN: { text: 'text-warn', bg: 'bg-warn/10' },
  ERROR: { text: 'text-error', bg: 'bg-error/10' },
}

export default function LogsPage() {
  const { data: logs = [] } = useSWR<LogEntry[]>('/api/logs', fetcher)
  const [paused, setPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { on, emit } = useSocket()

  const scrollToBottom = useCallback(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [autoScroll])

  useEffect(() => {
    scrollToBottom()
  }, [logs, scrollToBottom])

  useEffect(() => {
    emit('subscribe:logs')
    const unsub = on('log', () => {
      if (!paused) mutate('/api/logs')
    })
    return () => { unsub() }
  }, [on, emit, paused])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(atBottom)
  }

  const handleClear = async () => {
    await fetch('/api/logs', { method: 'DELETE' })
    mutate('/api/logs')
  }

  const handleExport = () => {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.level}] ${l.source ? `[${l.source}] ` : ''}${l.message}`)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-zero-logs-${new Date().toISOString().slice(0, 10)}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-1">Logs</h1>
          <p className="text-text-3 text-sm mt-0.5">{logs.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPaused(p => !p)}
          >
            {paused ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3 1.5L10.5 6L3 10.5V1.5Z" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="2" y="1.5" width="3" height="9" rx="0.5" />
                  <rect x="7" y="1.5" width="3" height="9" rx="0.5" />
                </svg>
                Pause
              </>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 1.5V8.5M3 6L6 8.5L9 6M2 10.5H10" />
            </svg>
            Export
          </Button>
        </div>
      </motion.div>

      {/* Log viewer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex-1 bg-bg-1 border border-border rounded-2xl overflow-hidden relative"
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-4 font-mono text-xs"
        >
          {logs.map((log, i) => {
            const lc = levelColors[log.level] || levelColors.INFO
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.005 }}
                className="flex items-start gap-3 py-1 px-2 rounded hover:bg-bg-2/50 group"
              >
                <span className="text-text-3 shrink-0 w-[65px]">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className={`
                  shrink-0 w-[50px] text-center rounded px-1 py-0.5 text-[10px] font-bold
                  ${lc.text} ${lc.bg}
                `}>
                  {log.level}
                </span>
                {log.source && (
                  <span className="text-text-3 shrink-0 w-[90px] truncate">
                    [{log.source}]
                  </span>
                )}
                <span className="text-text-2 group-hover:text-text-1 transition-colors">
                  {log.message}
                </span>
              </motion.div>
            )
          })}
          {/* Blinking cursor */}
          {!paused && (
            <div className="flex items-center gap-1 py-1 px-2 text-teal">
              <span className="cursor-blink">▋</span>
            </div>
          )}
        </div>

        {/* Jump to bottom */}
        {!autoScroll && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setAutoScroll(true)
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
            }}
            className="absolute bottom-4 right-4 bg-bg-3 border border-border rounded-xl px-3 py-1.5 text-xs text-text-2 hover:text-text-1 hover:border-border-hi transition-all cursor-pointer"
          >
            ↓ Jump to bottom
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
