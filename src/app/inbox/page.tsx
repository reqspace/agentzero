'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { useSocket } from '@/hooks/use-socket'
import { formatTime } from '@/lib/utils'
import type { Contact, Message, CallLog, CallTranscriptTurn } from '@/lib/db'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type InboxContact = Contact & {
  last_sms: string | null
  last_sms_at: string | null
  last_call_status: string | null
  last_call_duration: number | null
  last_call_at: string | null
  sms_count: number
  call_count: number
}

type ContactDetail = {
  contact: Contact
  messages: Message[]
  calls: (CallLog & { phone_number: string; display_name: string | null })[]
}

type CallDetail = {
  call: CallLog & { phone_number: string; display_name: string | null }
  turns: CallTranscriptTurn[]
}

type FilterTab = 'all' | 'sms' | 'calls'

export default function InboxPage() {
  const [activeContact, setActiveContact] = useState<string | null>(null)
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { on } = useSocket()

  const { data: contacts = [] } = useSWR<InboxContact[]>('/api/inbox', fetcher)
  const { data: contactDetail } = useSWR<ContactDetail>(
    activeContact ? `/api/contacts/${activeContact}` : null,
    fetcher
  )
  const { data: callDetail } = useSWR<CallDetail>(
    expandedCall ? `/api/calls/${expandedCall}` : null,
    fetcher
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [contactDetail])

  useEffect(() => {
    const unsub = on('inbox:update', () => {
      mutate('/api/inbox')
      if (activeContact) mutate(`/api/contacts/${activeContact}`)
    })
    const unsub2 = on('call:turn', () => {
      if (expandedCall) mutate(`/api/calls/${expandedCall}`)
    })
    const unsub3 = on('call:ended', () => {
      mutate('/api/inbox')
      if (activeContact) mutate(`/api/contacts/${activeContact}`)
    })
    return () => { unsub(); unsub2(); unsub3() }
  }, [on, activeContact, expandedCall])

  const filteredContacts = contacts.filter(c => {
    if (filter === 'sms') return c.sms_count > 0
    if (filter === 'calls') return c.call_count > 0
    return true
  })

  // Merge SMS and calls into a unified timeline
  const timeline = (() => {
    if (!contactDetail) return []
    const items: Array<{ type: 'sms'; data: Message } | { type: 'call'; data: CallLog }> = []
    for (const msg of contactDetail.messages) {
      items.push({ type: 'sms', data: msg })
    }
    for (const call of contactDetail.calls) {
      items.push({ type: 'call', data: call })
    }
    items.sort((a, b) => {
      const aTime = new Date('created_at' in a.data ? a.data.created_at : '').getTime()
      const bTime = new Date('created_at' in b.data ? b.data.created_at : '').getTime()
      return aTime - bTime
    })
    return items
  })()

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <div className="h-full flex">
      {/* Contact list */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-[320px] border-r border-border bg-bg-1 flex flex-col shrink-0"
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-text-1">Inbox</h1>
          <p className="text-text-3 text-xs mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border">
          {(['all', 'sms', 'calls'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer capitalize ${
                filter === tab
                  ? 'gradient-btn text-white'
                  : 'bg-bg-3 text-text-2 hover:bg-bg-4'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-text-3 text-sm">
              No contacts yet. Incoming SMS and calls will appear here.
            </div>
          ) : (
            filteredContacts.map((contact, i) => {
              const isActive = contact.id === activeContact
              const name = contact.display_name || contact.phone_number
              const lastTime = contact.last_interaction_at
              const preview = contact.last_sms
                ? contact.last_sms.replace(/\[SMS from [^\]]+\]\s*/, '').slice(0, 60)
                : contact.last_call_status
                  ? `Call - ${contact.last_call_status}${contact.last_call_duration ? ` (${formatDuration(contact.last_call_duration)})` : ''}`
                  : 'No messages'

              return (
                <motion.button
                  key={contact.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => {
                    setActiveContact(contact.id)
                    setExpandedCall(null)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-bg-2 border-l-[3px] border-l-orange'
                      : 'hover:bg-bg-2 border-l-[3px] border-l-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-bg-3 flex items-center justify-center shrink-0">
                    {contact.type === 'voice' ? (
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-teal">
                        <path d="M3 5C3 3.9 3.9 3 5 3H7L9 7L7.5 8C8.6 10.4 9.6 11.4 12 12.5L13 11L17 13V15C17 16.1 16.1 17 15 17C8 17 3 12 3 5Z" />
                      </svg>
                    ) : contact.type === 'both' ? (
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-orange">
                        <path d="M3 5C3 3.9 3.9 3 5 3H7L9 7L7.5 8C8.6 10.4 9.6 11.4 12 12.5L13 11L17 13V15C17 16.1 16.1 17 15 17C8 17 3 12 3 5Z" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-pink">
                        <path d="M4 4H16C17 4 17.5 4.5 17.5 5.5V13C17.5 14 17 14.5 16 14.5H12L10 17L8 14.5H4C3 14.5 2.5 14 2.5 13V5.5C2.5 4.5 3 4 4 4Z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-1 truncate">{name}</span>
                      {lastTime && (
                        <span className="text-[10px] text-text-3 shrink-0 ml-2">{formatTime(lastTime)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-text-3 truncate">{preview}</span>
                      {contact.unread_count > 0 && (
                        <span className="bg-pink text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 ml-2">
                          {contact.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1">
                      {contact.sms_count > 0 && (
                        <span className="text-[10px] text-text-3 flex items-center gap-0.5">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3H13C14 3 14 4 14 4V11C14 11 14 12 13 12H9L7 14.5L5 12H3C3 12 2 12 2 11V4C2 4 2 3 3 3Z" /></svg>
                          {contact.sms_count}
                        </span>
                      )}
                      {contact.call_count > 0 && (
                        <span className="text-[10px] text-text-3 flex items-center gap-0.5">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4C2 3 3 2 4 2H6L7.5 5.5L6 6.5C7 8.5 8 9.5 10 10.5L11 9L14.5 11V13C14.5 14 13.5 15 12.5 15C6 15 2 10 2 4Z" /></svg>
                          {contact.call_count}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })
          )}
        </div>
      </motion.div>

      {/* Thread view */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeContact && contactDetail ? (
          <>
            {/* Thread header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-bg-3 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-2">
                    <circle cx="10" cy="7" r="3" />
                    <path d="M4 17C4 13.7 6.7 11 10 11C13.3 11 16 13.7 16 17" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-1">
                    {contactDetail.contact.display_name || contactDetail.contact.phone_number}
                  </h2>
                  <div className="text-[10px] text-text-3">
                    {contactDetail.contact.phone_number}
                    {contactDetail.contact.display_name ? '' : ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-3">
                <span>{contactDetail.messages.length} SMS</span>
                <span>|</span>
                <span>{contactDetail.calls.length} Calls</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="max-w-[700px] mx-auto space-y-3">
                {timeline.length === 0 ? (
                  <div className="text-center text-text-3 text-sm py-12">
                    No interactions yet
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {timeline.map((item, i) => {
                      if (item.type === 'sms') {
                        const msg = item.data
                        const isIncoming = msg.role === 'user'
                        const displayContent = msg.content.replace(/\[SMS from [^\]]+\]\s*/, '')
                        return (
                          <motion.div
                            key={`sms-${msg.id}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.01 }}
                            className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                              isIncoming
                                ? 'bg-bg-2 border border-border text-text-1'
                                : 'bg-gradient-to-br from-orange to-pink text-white'
                            }`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-50"><path d="M3 3H13C14 3 14 4 14 4V11C14 11 14 12 13 12H9L7 14.5L5 12H3C3 12 2 12 2 11V4C2 4 2 3 3 3Z" /></svg>
                                <span className="text-[10px] opacity-50">SMS</span>
                              </div>
                              <p className="leading-relaxed">{displayContent}</p>
                              <p className={`text-[10px] mt-1 ${isIncoming ? 'text-text-3' : 'text-white/60'}`}>
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          </motion.div>
                        )
                      }

                      // Call log card
                      const call = item.data as CallLog
                      const isExpanded = expandedCall === call.id
                      return (
                        <motion.div
                          key={`call-${call.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.01 }}
                        >
                          <button
                            onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                            className="w-full bg-bg-2 border border-border rounded-2xl p-4 text-left hover:border-border-hi transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  call.status === 'completed' ? 'bg-teal/10' : 'bg-error/10'
                                }`}>
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={
                                    call.status === 'completed' ? 'text-teal' : 'text-error'
                                  }>
                                    <path d="M3 5C3 3.9 3.9 3 5 3H7L9 7L7.5 8C8.6 10.4 9.6 11.4 12 12.5L13 11L17 13V15C17 16.1 16.1 17 15 17C8 17 3 12 3 5Z" />
                                  </svg>
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-text-1">
                                    {call.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call'}
                                  </span>
                                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                                    call.status === 'completed'
                                      ? 'bg-teal/10 text-teal'
                                      : call.status === 'failed'
                                        ? 'bg-error/10 text-error'
                                        : 'bg-warn/10 text-warn'
                                  }`}>
                                    {call.status}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-text-3">
                                {call.duration_seconds > 0 && (
                                  <span className="text-xs">{formatDuration(call.duration_seconds)}</span>
                                )}
                                <span className="text-[10px]">{formatTime(call.created_at)}</span>
                                <svg
                                  width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                                  className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                  <path d="M3 5L6 8L9 5" />
                                </svg>
                              </div>
                            </div>

                            {/* Transcript preview */}
                            {call.transcript && !isExpanded && (
                              <p className="text-xs text-text-3 mt-2 line-clamp-2">
                                {call.transcript.slice(0, 150)}...
                              </p>
                            )}
                          </button>

                          {/* Expanded transcript */}
                          <AnimatePresence>
                            {isExpanded && callDetail && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-bg-1 border border-t-0 border-border rounded-b-2xl p-4 space-y-2">
                                  <div className="text-[10px] text-text-3 uppercase tracking-wider mb-3">Transcript</div>
                                  {callDetail.turns.map(turn => (
                                    <div
                                      key={turn.id}
                                      className={`flex ${turn.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                                        turn.role === 'agent'
                                          ? 'bg-teal/10 border border-teal/20 text-text-1'
                                          : 'bg-bg-3 border border-border text-text-1'
                                      }`}>
                                        <span className={`text-[10px] font-semibold block mb-0.5 ${
                                          turn.role === 'agent' ? 'text-teal' : 'text-text-3'
                                        }`}>
                                          {turn.role === 'agent' ? 'Agent Zero' : 'Caller'}
                                        </span>
                                        {turn.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-bg-2 border border-border flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-3">
                <path d="M4 4H20C21 4 22 5 22 6V16C22 17 21 18 20 18H12L8 22V18H4C3 18 2 17 2 16V6C2 5 3 4 4 4Z" />
                <path d="M8 10H16M8 14H12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-1 mb-1">Inbox</h2>
            <p className="text-text-3 text-sm max-w-sm">
              Incoming SMS messages and voice calls will appear here, grouped by contact.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
