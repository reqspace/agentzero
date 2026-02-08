'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

let globalSocket: Socket | null = null

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
    })
  }
  return globalSocket
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = getSocket()
    if (!socketRef.current.connected) {
      socketRef.current.connect()
    }
    return () => {
      // don't disconnect shared socket
    }
  }, [])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const socket = getSocket()
    socket.on(event, handler)
    return () => { socket.off(event, handler) }
  }, [])

  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket()
    socket.emit(event, data)
  }, [])

  return { on, emit, socket: socketRef.current }
}
