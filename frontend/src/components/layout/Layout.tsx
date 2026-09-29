import { useEffect, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { NotificationPermission } from '@/components/notifications/NotificationPermission'
import { useDeviceStore } from '@/stores/deviceStore'
import { devicesApi } from '@/api/devices'
import { initServiceWorker } from '@/lib/sw-registration'

const PING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { deviceId } = useDeviceStore()

  // Auto-register the Service Worker and push subscription on every
  // authenticated page load. If permission was already granted in a previous
  // session this runs silently and ensures the device is always registered.
  useEffect(() => {
    initServiceWorker().catch(() => {
      // Silently ignore — the NotificationPermission banner handles the UX.
    })
  }, [])

  // Auto-ping the registered device every 5 minutes while the app is open.
  // This keeps `last_active_at` fresh so the backend can target the active
  // device for notifications (and prune stale subscriptions via GoneException).
  useEffect(() => {
    if (!deviceId) return

    const ping = () => {
      devicesApi.ping(deviceId).catch(() => {
        // Silently ignore ping failures — they're non-critical heartbeats.
      })
    }

    // Ping immediately on mount so we don't wait 5 minutes for the first update.
    ping()

    const interval = setInterval(ping, PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [deviceId])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        <NotificationPermission />
        <div className="max-w-[1200px] mx-auto px-4 py-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
