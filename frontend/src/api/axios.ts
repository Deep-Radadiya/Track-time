import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

// The server address comes from VITE_API_URL. Without it we assume the server runs on this same site.
const envApiUrl = import.meta.env.VITE_API_URL as string | undefined
const fallbackApiUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
const API_URL = envApiUrl || fallbackApiUrl

console.debug('[API] configured baseURL:', API_URL)

// Every API file (tasks.ts, auth.ts, ...) uses this one axios instance.
export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// --- Before each request: attach the login token ---
// Login, signup and refresh are skipped on purpose: they don't need a token, and an old
// token there would make the 401 handler below start a refresh for no reason.
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh']
api.interceptors.request.use((config) => {
  const url = config.url ?? ''
  const isPublic = PUBLIC_AUTH_PATHS.some((path) => url.includes(path))
  if (!isPublic) {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// --- Only one token refresh at a time ---
// Both the 401 handler below and the useTokenRefresh hook call refreshAccessToken().
// The server accepts each refresh token only once, so two refreshes at the same moment would
// log the user out. While one refresh is running, every other caller waits for the same promise.
let refreshPromise: Promise<string> | null = null

/**
 * Gets a new access token using the refresh token saved in localStorage.
 * Returns the new access token, or throws if the refresh fails.
 */
export async function refreshAccessToken(): Promise<string> {
  // A refresh is already running: wait for that one instead of starting another.
  if (refreshPromise) return refreshPromise

  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  refreshPromise = (async () => {
    try {
      // Plain axios (not `api`), so this call never goes through the 401 handler below.
      const { data } = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      })
      const newAccessToken: string = data.access_token
      const newRefreshToken: string = data.refresh_token

      useAuthStore.getState().setAccessToken(newAccessToken)
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken)
      }
      api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`
      console.debug('[Auth] Token refreshed proactively/reactively')
      return newAccessToken
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// Logs the user out locally and sends them to the login page.
function goToLogin() {
  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
}

// --- After each response: on 401 (token expired), refresh once and retry the request ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Leave alone: other errors, requests we already retried once,
    // and the refresh call itself (otherwise it could loop forever).
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      (originalRequest.url as string | undefined)?.includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    if (!localStorage.getItem('refresh_token')) {
      goToLogin()
      return Promise.reject(error)
    }

    // A refresh is already running (from the hook or another 401): wait for it, then retry.
    if (refreshPromise) {
      return refreshPromise.then((token) => {
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${token}`
        originalRequest._retry = true
        return api(originalRequest)
      })
    }

    originalRequest._retry = true

    try {
      const newAccessToken = await refreshAccessToken()
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      goToLogin()
      return Promise.reject(refreshError)
    }
  },
)

export default api
