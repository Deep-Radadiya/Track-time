import { authApi } from '@/api/auth'
import { idbClearToken, useAuthStore } from '@/stores/authStore'
import { useWsStore } from '@/stores/wsStore'
import { registerPushSubscription, unregisterServiceWorker } from '@/lib/sw-registration'
import { useQueryClient } from '@tanstack/react-query'
import { parseApiError } from '@/lib/utils'
import type { TokenResponse } from '@/types/api'
import toast from 'react-hot-toast'

/**
 * The "Reset app data" link on the login and signup pages.
 * Clears everything this site saved in the browser (tokens, service worker), then reloads.
 * Useful when an old login or an old service worker gets stuck.
 */
export async function resetAppData() {
  try {
    localStorage.clear()
    await idbClearToken()
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    toast.success('App data cleared — please try again.')
    window.location.reload()
  } catch {
    toast.error('Could not reset app data.')
  }
}

export function useAuth() {
  const { setAuth, clearAuth } = useAuthStore()
  const { socket } = useWsStore()
  const queryClient = useQueryClient()

  // Shared last steps of login and signup: save the tokens, load the user, turn on notifications.
  const finishLogin = async (tokens: TokenResponse) => {
    localStorage.setItem('refresh_token', tokens.refresh_token)
    // The token must be in the store first, so the /auth/me request below is sent with it.
    useAuthStore.getState().setAccessToken(tokens.access_token)

    const user = await authApi.me()
    setAuth(tokens.access_token, user)
    // Not awaited, so the browser's permission popup doesn't hold up the login.
    registerPushSubscription().catch(console.error)
    return user
  }

  const login = async (email: string, password: string) =>
    finishLogin(await authApi.login({ email, password }))

  const signup = async (email: string, password: string, timezone: string) =>
    finishLogin(await authApi.signup({ email, password, timezone }))

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    try {
      // Tell the server, so this refresh token can never be used again.
      if (refreshToken) await authApi.logout(refreshToken)
    } catch (err) {
      console.warn('Logout API call failed:', parseApiError(err))
    }
    socket?.close()
    await unregisterServiceWorker()
    queryClient.clear()
    clearAuth()
    toast.success('Signed out successfully')
  }

  return { login, signup, logout }
}
