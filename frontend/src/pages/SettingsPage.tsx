import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bell, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'
import { registerPushSubscription } from '@/lib/sw-registration'
import { parseApiError } from '@/lib/utils'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleEnablePush = async () => {
    try {
      await registerPushSubscription()
      toast.success('Notifications enabled!')
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const notificationStatus =
    typeof Notification !== 'undefined' ? Notification.permission : 'default'

  return (
    <div className="space-y-6 w-full max-w-2xl select-none">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary">{user?.email}</p>
      </div>

      {/* Notification Permission / Status */}
      <div className="glass-card p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
          <Bell size={14} /> Notification Permission / Status
        </h2>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary capitalize">{notificationStatus}</p>
          {notificationStatus !== 'granted' && (
            <button onClick={handleEnablePush} className="btn-secondary py-1.5 px-3 text-xs shrink-0">
              Enable
            </button>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="glass-card p-4 sm:p-5 space-y-4">
        <button
          onClick={handleLogout}
          className="w-full btn-ghost py-2.5 px-4 text-sm bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </div>
  )
}
