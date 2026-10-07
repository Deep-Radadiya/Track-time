import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/api/auth'
import { registerPushSubscription } from '@/lib/sw-registration'
import { parseApiError } from '@/lib/utils'
import toast from 'react-hot-toast'

import {
  ToggleLeft,
  ToggleRight,
  Bell,
  LogOut
} from 'lucide-react'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { logout } = useAuth()
  const navigate = useNavigate()
  
  
  // Settings state
  const [savingSettings, setSavingSettings] = useState(false)

  // Local form state
  const [settings, setSettings] = useState({
    working_hours_start: user?.working_hours_start || '09:00:00',
    working_hours_end: user?.working_hours_end || '17:00:00',
    checkin_interval_minutes: user?.checkin_interval_minutes || 60,
    daily_summary_enabled: user?.daily_summary_enabled ?? true,
    reminders_enabled: user?.reminders_enabled ?? true,
    checkin_enabled: user?.checkin_enabled ?? true,
  })

  // When global user changes, update local state
  useEffect(() => {
    if (user) {
      setSettings({
        working_hours_start: user.working_hours_start,
        working_hours_end: user.working_hours_end,
        checkin_interval_minutes: user.checkin_interval_minutes,
        daily_summary_enabled: user.daily_summary_enabled,
        reminders_enabled: user.reminders_enabled,
        checkin_enabled: user.checkin_enabled,
      })
    }
  }, [user])

  const handleRegisterPush = async () => {
    try {
      await registerPushSubscription()
      toast.success('Device registered for push notifications!')
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  const handleSettingChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const updatedUser = await authApi.updateMe(settings)
      setUser(updatedUser)
      toast.success('Settings saved successfully!')
    } catch (err) {
      toast.error(parseApiError(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="space-y-6 w-full max-w-2xl select-none">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary">Configure app preferences and notification endpoints.</p>
      </div>

      {/* Account Info */}
      <div className="glass-card p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">Account Profile</h2>
        <p className="text-sm flex flex-wrap items-baseline gap-x-2">
          <span className="text-text-muted">Email address:</span>
          <span className="text-text-primary font-medium break-all">{user?.email}</span>
        </p>
      </div>

      {/* Notification Preferences */}
      <div className="glass-card p-4 sm:p-5 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">Notifications & Preferences</h2>
        
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">Task Reminders</p>
            <p className="text-xs text-text-muted">Receive alerts when tasks are due</p>
          </div>
          <button
            onClick={() => handleSettingChange('reminders_enabled', !settings.reminders_enabled)}
            className="text-primary hover:opacity-80 transition-opacity shrink-0"
          >
            {settings.reminders_enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-text-muted" />}
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button 
            onClick={handleSaveSettings} 
            disabled={savingSettings}
            className="btn-primary w-full sm:w-auto py-2 px-4 text-sm disabled:opacity-50"
          >
            {savingSettings ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Push setup */}
      <div className="glass-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Bell size={14} /> Web Push Notifications
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Register this browser window to receive alerts for upcoming reminders when the app tab is offline or closed.
            </p>
          </div>
          <button onClick={handleRegisterPush} className="btn-secondary w-full sm:w-auto py-1.5 px-3 text-xs shrink-0 whitespace-nowrap">
            Enable Push
          </button>
        </div>
      </div>

      {/* Account Actions (Visible mostly for mobile) */}
      <div className="md:hidden glass-card p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-danger">Account Actions</h2>
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