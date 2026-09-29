import { Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Reminder } from '@/types/api'
import { formatSchedule, formatLunch } from '@/lib/utils'

interface ReminderCardProps {
  reminder: Reminder
  onEdit: (reminder: Reminder) => void
  onDelete: (reminder: Reminder) => void
  onToggleActive: (reminder: Reminder) => void
}

export function ReminderCard({ reminder, onEdit, onDelete, onToggleActive }: ReminderCardProps) {
  return (
    <div className="glass-card p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">{reminder.title}</p>
        <p className="text-xs text-text-muted mt-0.5">{formatSchedule(reminder)}</p>
        {formatLunch(reminder) && (
          <p className="text-xs text-text-muted/70 mt-0.5">{formatLunch(reminder)}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onEdit(reminder)}
          className="btn-ghost py-1.5 px-2.5 text-xs bg-white/5 border border-border hover:bg-white/10 flex items-center gap-1.5 text-text-secondary"
        >
          <Pencil size={14} /> Edit
        </button>
        <button
          onClick={() => onDelete(reminder)}
          className="btn-ghost py-1.5 px-2.5 text-xs bg-danger/10 border border-danger/20 hover:bg-danger/20 flex items-center gap-1.5 text-danger"
        >
          <Trash2 size={14} /> Delete
        </button>
        <button
          onClick={() => onToggleActive(reminder)}
          className="text-primary hover:opacity-80 transition-opacity"
          title={reminder.is_active ? 'Active — click to disable' : 'Disabled — click to enable'}
        >
          {reminder.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-text-muted" />}
        </button>
      </div>
    </div>
  )
}
