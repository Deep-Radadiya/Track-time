import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useWsStore } from '@/stores/wsStore'
import { api } from '@/api/axios'
import { getTokenExpiry } from '@/lib/utils'
import { TASKS_KEY } from './useTasks'

const API_URL = import.meta.env.VITE_API_URL as string ?? 'http://localhost:8000'
const WS_URL = API_URL.replace(/^http/, 'ws')

// Server messages that mean "the reminder list changed", so the list is loaded again.
const INVALIDATING_EVENTS = new Set(['task_created', 'task_updated', 'task_deleted', 'task_action'])

/** Returns true if the token expires within the next `bufferSeconds` seconds. */
function isTokenNearExpiry(token: string, bufferSeconds = 60): boolean {
  const exp = getTokenExpiry(token)
  if (!exp) return true
  return exp - Date.now() / 1000 < bufferSeconds
}

/**
 * Keeps one live WebSocket connection to the server while the user is logged in.
 * When another tab or the reminder timer changes a task, the server sends a message
 * and we reload the reminder list. If the connection drops, we reconnect with a
 * growing delay (1s, 2s, 4s ... up to 30s).
 */
export function useWebSocket() {
  const { accessToken, isAuthenticated } = useAuthStore()
  const { setSocket, setStatus } = useWsStore()
  const queryClient = useQueryClient()
  const reconnectDelay = useRef(1000)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  // Debounce guard: prevents the access-token-change → re-render → close →
  // immediate reopen storm. When the Axios interceptor updates the token the
  // Zustand state fires synchronously; we give it 150 ms to settle before
  // opening a new socket so we open exactly once with the freshest token.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connectWithToken = useCallback((token: string) => {
    // Clear any pending reconnect timer so we don't double-connect.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    setStatus('connecting')
    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`)
    socketRef.current = ws
    setSocket(ws)

    ws.onopen = () => {
      setStatus('connected')
      reconnectDelay.current = 1000
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { event?: string }

        if (data.event && INVALIDATING_EVENTS.has(data.event)) {
          queryClient.invalidateQueries({ queryKey: TASKS_KEY })
        }
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onclose = () => {
      if (socketRef.current !== ws) return

      setStatus('reconnecting')
      setSocket(null)
      if (!useAuthStore.getState().isAuthenticated) return

      const delay = reconnectDelay.current
      reconnectDelay.current = Math.min(delay * 2, 30_000)

      // Ping the server to trigger the Axios 401 → refresh interceptor.
      // Wait for it to settle before scheduling the reconnect so the store
      // holds the new token by the time we call connect().
      api.get('/auth/me').catch(() => {}).finally(() => {
        timeoutRef.current = setTimeout(() => {
          const freshToken = useAuthStore.getState().accessToken
          if (freshToken && useAuthStore.getState().isAuthenticated) {
            connectWithToken(freshToken)
          }
        }, delay)
      })
    }

    ws.onerror = () => {
      if (socketRef.current === ws) ws.close()
    }
  }, [queryClient, setSocket, setStatus])

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Close any open socket and cancel reconnect timers.
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setStatus('disconnected')
      return
    }

    // Debounce: wait 150 ms for any rapid token-change bursts to settle.
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const token = useAuthStore.getState().accessToken
      if (!token || !useAuthStore.getState().isAuthenticated) return

      // Close the existing socket before opening a new one so we don't leak.
      if (socketRef.current) {
        // Detach handlers to suppress the onclose reconnect logic for this
        // intentional close — we're about to reconnect right away.
        const oldWs = socketRef.current
        socketRef.current = null
        oldWs.onclose = null
        oldWs.onerror = null
        oldWs.close()
      }

      // If the token is stale or expiring soon, let the Axios interceptor
      // refresh it first so we don't open a socket that will immediately 403.
      if (isTokenNearExpiry(token)) {
        try {
          await api.get('/auth/me')
        } catch {
          // Interceptor will have refreshed the token or logged the user out.
        }
      }

      // Re-read from the store — the interceptor may have updated the token.
      const freshToken = useAuthStore.getState().accessToken
      if (freshToken && useAuthStore.getState().isAuthenticated) {
        connectWithToken(freshToken)
      }
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isAuthenticated, accessToken, connectWithToken, setStatus])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])
}
