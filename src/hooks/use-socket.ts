'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@clerk/nextjs'

let globalSocket: Socket | null = null

function getSocket(getToken: () => Promise<string | null>): Socket {
  if (!globalSocket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    globalSocket = io(url, {
      transports: ['websocket', 'polling'],
      auth: async (cb) => {
        const token = await getToken()
        cb({ token })
      },
    })
  }
  return globalSocket
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const { getToken } = useAuth()

  useEffect(() => {
    socketRef.current = getSocket(getToken)
    if (!socketRef.current.connected) {
      socketRef.current.connect()
    }
    return () => {
      // don't disconnect shared socket
    }
  }, [getToken])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const socket = getSocket(getToken)
    socket.on(event, handler)
    return () => { socket.off(event, handler) }
  }, [getToken])

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket(getToken)
    socket.emit(event, data)
  }, [getToken])

  return { on, emit, socket: socketRef.current }
}
