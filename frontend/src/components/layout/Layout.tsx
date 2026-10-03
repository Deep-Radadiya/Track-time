import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ThemeToggle } from './ThemeToggle'
import { Bell } from 'lucide-react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { NotificationPermission } from '@/components/notifications/NotificationPermission'
import { useDeviceStore } from '@/stores/deviceStore'
import { devicesApi } from '@/api/devices'
import { initServiceWorker } from '@/lib/sw-registration'
import { HourlyReminderPanel } from '@/components/notifications/HourlyReminderPanel'
import { TaskCreateModal } from '@/components/tasks/TaskCreateModal'

import { useCheckinPanelStore } from '@/stores/checkinPanelStore'

const PING_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  useWebSocket()
  const { deviceId } = useDeviceStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOpen: isHourlyReminderOpen, reminderId, open: openCheckin, close: closeCheckin } = useCheckinPanelStore()
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)

  // Handle URL params for notification-driven panels.
  useEffect(() => {
    const shouldOpenCheckin = searchParams.get('checkin') === '1'
    const newReminderId = searchParams.get('reminderId') ?? undefined
    const shouldOpenAddTask = searchParams.get('addTask') === '1'

    if (shouldOpenCheckin || newReminderId) {
      openCheckin(newReminderId)
    }
    if (shouldOpenAddTask) {
      setIsCreateTaskOpen(true)
    }
    if (shouldOpenCheckin || newReminderId || shouldOpenAddTask) {
      setSearchParams((prev) => {
        prev.delete('checkin')
        prev.delete('reminderId')
        prev.delete('addTask')
        return prev
      }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Handle SW messages for check-in panel
  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'OPEN_CHECKIN_PANEL') {
        openCheckin(event.data.reminderId ?? undefined)
      }
      if (event.data && event.data.type === 'OPEN_ADD_TASK_MODAL') {
        setIsCreateTaskOpen(true)
      }
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage)
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage)
      }
    }
  }, [])

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
        {/* Phone header (the sidebar is hidden on small screens) */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-bg/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl brand-gradient flex items-center justify-center">
              <Bell size={15} className="text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-text-primary">Donezo</span>
          </div>
          <div className="w-11">
            <ThemeToggle />
          </div>
        </header>
        <NotificationPermission />
        <div className="max-w-[1100px] mx-auto px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-8">
          {children}
        </div>
      </main>
      <BottomNav />

      {/* Global Modals/Overlays */}
      <AnimatePresence>
        {isHourlyReminderOpen && (
          <HourlyReminderPanel
            onClose={() => closeCheckin()}
            reminderId={reminderId}
          />
        )}
      </AnimatePresence>
      <TaskCreateModal open={isCreateTaskOpen} onClose={() => setIsCreateTaskOpen(false)} />
    </div>
  )
}
