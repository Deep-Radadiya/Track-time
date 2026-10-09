/**
 * Auth store with IndexedDB persistence for the access token.
 *
 * WHY IndexedDB (not localStorage):
 * Service workers cannot access localStorage — it's only available on the
 * main thread. IndexedDB is available in both the main thread AND service
 * workers, so storing the access token there lets the SW authenticate
 * in-notification "Done" / "Snooze" action buttons without an action_token.
 */
import { create } from 'zustand'
import type { User } from '@/types/api'

const IDB_NAME = 'smartreminder-db'
const IDB_STORE = 'auth'
const IDB_VERSION = 1

// ── IndexedDB helpers ──────────────────────────────────────────────────────
// The token is saved under the key 'access_token' in the 'auth' store.
// public/sw.js reads the same place, so keep these names in sync with it.

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function idbSetToken(token: string): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(token, 'access_token')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Ignore: the app keeps the token in memory too, so it still works without IndexedDB
  }
}

export async function idbGetToken(): Promise<string | null> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get('access_token')
      req.onsuccess = () => resolve((req.result as string) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function idbClearToken(): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete('access_token')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Ignore: nothing to clear if IndexedDB is not available
  }
}

// ── Zustand store ──────────────────────────────────────────────────────────

interface AuthState {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean

  // Logged in: save the token and the user.
  setAuth: (accessToken: string, user: User) => void
  // A new token (after login or a refresh). The user stays the same.
  setAccessToken: (accessToken: string) => void
  // The user changed (e.g. settings saved). Login state stays the same.
  setUser: (user: User) => void
  // Logged out: forget everything.
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (accessToken, user) => {
    idbSetToken(accessToken)
    set({ accessToken, user, isAuthenticated: true })
  },

  setAccessToken: (accessToken) => {
    idbSetToken(accessToken)
    set({ accessToken, isAuthenticated: true })
  },

  setUser: (user) => {
    set({ user })
  },

  clearAuth: () => {
    localStorage.removeItem('refresh_token')
    idbClearToken()
    set({ accessToken: null, user: null, isAuthenticated: false })
  },
}))
