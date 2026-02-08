'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSocket } from '@/hooks/use-socket'

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10L10 3L17 10" />
        <path d="M5 8.5V16C5 16.5 5.5 17 6 17H8.5V12.5C8.5 12 9 11.5 9.5 11.5H10.5C11 11.5 11.5 12 11.5 12.5V17H14C14.5 17 15 16.5 15 16V8.5" />
      </svg>
    ),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="4" height="11" rx="1" />
        <rect x="8" y="3" width="4" height="14" rx="1" />
        <rect x="14" y="9" width="4" height="8" rx="1" />
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4H16C17 4 17.5 4.5 17.5 5.5V13C17.5 14 17 14.5 16 14.5H12L10 17L8 14.5H4C3 14.5 2.5 14 2.5 13V5.5C2.5 4.5 3 4 4 4Z" />
        <circle cx="14" cy="4" r="2.5" fill="#ff3d8b" stroke="none" />
      </svg>
    ),
    badge: true,
  },
  {
    href: '/integrations',
    label: 'Integrations',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2V4M10 16V18M18 10H16M4 10H2" />
        <path d="M15.66 4.34L14.24 5.76M5.76 14.24L4.34 15.66M15.66 15.66L14.24 14.24M5.76 5.76L4.34 4.34" />
      </svg>
    ),
  },
  {
    href: '/skills',
    label: 'Skills',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M10 2L12.4 7.2L18 7.8L13.8 11.6L15 17.2L10 14.4L5 17.2L6.2 11.6L2 7.8L7.6 7.2L10 2Z" />
      </svg>
    ),
  },
  {
    href: '/logs',
    label: 'Logs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="3" width="15" height="14" rx="2" />
        <path d="M6 8L8 10L6 12" />
        <path d="M10 12H14" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="2.5" />
        <path d="M10 1.5V4M10 16V18.5M18.5 10H16M4 10H1.5M16 4L14.2 5.8M5.8 14.2L4 16M16 16L14.2 14.2M5.8 5.8L4 4" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { on } = useSocket()
  const [agentOnline, setAgentOnline] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const unsub1 = on('agent:status', (data: unknown) => {
      const status = data as { online: boolean }
      setAgentOnline(status.online)
    })
    return () => { unsub1() }
  }, [on])

  // Fetch unread count
  useEffect(() => {
    fetch('/api/channels')
      .then(r => r.json())
      .then((channels: { unread_count: number }[]) => {
        setUnreadMessages(channels.reduce((sum: number, c: { unread_count: number }) => sum + c.unread_count, 0))
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col items-center w-[68px] h-screen bg-bg-1 border-r border-border fixed left-0 top-0 z-50">
        {/* Logo */}
        <Link href="/" className="mt-4 mb-6">
          <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-xl gradient-btn">
            🦞
          </div>
        </Link>

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative group"
              >
                <div className={`
                  relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200
                  ${isActive
                    ? 'text-orange bg-orange/10'
                    : 'text-text-3 hover:text-text-2 hover:bg-bg-3'
                  }
                `}>
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-indicator"
                      className="absolute left-[-14px] w-[3px] h-5 bg-orange rounded-r-full"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  {/* Active glow */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-orange/5 blur-sm" />
                  )}
                  {item.icon}
                  {/* Badge for messages */}
                  {item.badge && unreadMessages > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-pink rounded-full status-pulse" />
                  )}
                </div>

                {/* Tooltip */}
                <div className="
                  absolute left-14 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg
                  bg-bg-3 border border-border-hi text-text-1 text-xs font-medium
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150
                  pointer-events-none whitespace-nowrap z-[60]
                ">
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Agent status */}
        <div className="mb-4 flex flex-col items-center gap-3">
          <button
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-bg-3 transition-colors"
            title={agentOnline ? 'Agent Online — Click to stop' : 'Agent Offline — Click to start'}
          >
            <div className={`
              w-3 h-3 rounded-full
              ${agentOnline ? 'bg-teal status-pulse text-teal' : 'bg-error text-error'}
            `} />
          </button>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-bg-1 border-t border-border z-50 flex items-center justify-around px-2">
        {navItems.slice(0, 5).map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center w-12 h-12 rounded-xl
                ${isActive ? 'text-orange' : 'text-text-3'}
              `}
            >
              {item.icon}
              {isActive && (
                <motion.div
                  layoutId="mobile-indicator"
                  className="absolute -bottom-1 w-4 h-[2px] bg-orange rounded-full"
                />
              )}
              {item.badge && unreadMessages > 0 && (
                <span className="absolute top-1 right-0.5 w-2 h-2 bg-pink rounded-full" />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
