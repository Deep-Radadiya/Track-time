import { Plus } from 'lucide-react'
import type { Reminder } from '@/types/api'
import { ReminderCard } from './ReminderCard'

interface ReminderListProps {
  reminders: Reminder[]
  onEdit: (reminder: Reminder) => void
  onDelete: (reminder: Reminder) => void
  onToggleActive: (reminder: Reminder) => void
  onCreate: () => void
}

export function ReminderList({ reminders, onEdit, onDelete, onToggleActive, onCreate }: ReminderListProps) {
  if (reminders.length === 0) {
    return (
      <div className="glass-card p-8 text-center space-y-4">
        <p className="text-text-secondary">No reminders yet.</p>
        <p className="text-sm text-text-muted">Create your first reminder.</p>
        <button onClick={onCreate} className="btn-primary inline-flex items-center gap-1.5 py-2 px-4">
          <Plus size={18} /> Add Reminder
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">My Reminders</h2>
      {reminders.map((reminder) => (
        <ReminderCard
          key={reminder.id}
          reminder={reminder}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
        />
      ))}
    </div>
  )
}
