import { useState } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useReminders, useDeleteReminder, useUpdateReminder } from '@/hooks/useReminders'
import { ReminderList } from '@/components/reminders/ReminderList'
import { ReminderFormModal } from '@/components/reminders/ReminderFormModal'
import { parseApiError } from '@/lib/utils'
import type { Reminder } from '@/types/api'

export default function DashboardPage() {
  const { data: reminders = [], isLoading, error } = useReminders()
  const deleteReminder = useDeleteReminder()
  const updateReminder = useUpdateReminder()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const openCreate = () => {
    setEditingReminder(null)
    setIsFormOpen(true)
  }

  const openEdit = (reminder: Reminder) => {
    setEditingReminder(reminder)
    setIsFormOpen(true)
  }

  const handleDelete = async (reminder: Reminder) => {
    if (!window.confirm(`Delete "${reminder.title}"?`)) return
    try {
      await deleteReminder.mutateAsync(reminder.id)
      toast.success('Reminder deleted')
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  const handleToggleActive = async (reminder: Reminder) => {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        data: {
          title: reminder.title,
          repeat_type: reminder.repeat_type,
          time: reminder.time,
          date: reminder.date,
          day_of_week: reminder.day_of_week,
          day_of_month: reminder.day_of_month,
          active_start: reminder.active_start,
          active_end: reminder.active_end,
          lunch_start: reminder.lunch_start,
          lunch_end: reminder.lunch_end,
          is_active: !reminder.is_active,
        },
      })
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center select-none">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">SmartReminder</h1>
          <p className="text-sm text-text-secondary">Never miss an important reminder.</p>
        </div>

        <button onClick={openCreate} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-1.5 py-2">
          <Plus size={18} /> Add Reminder
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded-md w-3/4" />
              <div className="h-3 bg-white/5 rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-danger/20 bg-danger/5 text-danger text-sm">
          Failed to load reminders. Please check your network connection.
        </div>
      ) : (
        <ReminderList
          reminders={reminders}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onCreate={openCreate}
        />
      )}

      <ReminderFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} reminder={editingReminder} />
    </div>
  )
}
