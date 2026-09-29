import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCreateReminder, useUpdateReminder } from '@/hooks/useReminders'
import { parseApiError } from '@/lib/utils'
import type { Reminder, RepeatType } from '@/types/api'

interface ReminderFormModalProps {
  open: boolean
  onClose: () => void
  reminder?: Reminder | null
}

const REPEAT_OPTIONS: { value: RepeatType; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const WEEKDAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
]

export function ReminderFormModal({ open, onClose, reminder }: ReminderFormModalProps) {
  const isEditing = !!reminder
  const createReminder = useCreateReminder()
  const updateReminder = useUpdateReminder()

  const [title, setTitle] = useState('')
  const [repeatType, setRepeatType] = useState<RepeatType>('daily')
  const [time, setTime] = useState('09:00')
  const [date, setDate] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [activeStart, setActiveStart] = useState('09:00')
  const [activeEnd, setActiveEnd] = useState('18:00')
  const [lunchEnabled, setLunchEnabled] = useState(false)
  const [lunchStart, setLunchStart] = useState('13:00')
  const [lunchEnd, setLunchEnd] = useState('14:00')

  useEffect(() => {
    if (!open) return
    setTitle(reminder?.title ?? '')
    setRepeatType(reminder?.repeat_type ?? 'daily')
    setTime(reminder?.time?.slice(0, 5) ?? '09:00')
    setDate(reminder?.date ?? '')
    setDayOfWeek(reminder?.day_of_week ?? 0)
    setDayOfMonth(reminder?.day_of_month ?? 1)
    setActiveStart(reminder?.active_start?.slice(0, 5) ?? '09:00')
    setActiveEnd(reminder?.active_end?.slice(0, 5) ?? '18:00')
    setLunchEnabled(!!(reminder?.lunch_start && reminder?.lunch_end))
    setLunchStart(reminder?.lunch_start?.slice(0, 5) ?? '13:00')
    setLunchEnd(reminder?.lunch_end?.slice(0, 5) ?? '14:00')
  }, [open, reminder])

  if (!open) return null

  const saving = createReminder.isPending || updateReminder.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    const payload = {
      title: title.trim(),
      repeat_type: repeatType,
      time: repeatType === 'hourly' ? null : `${time}:00`,
      date: repeatType === 'once' ? date : null,
      day_of_week: repeatType === 'weekly' ? dayOfWeek : null,
      day_of_month: repeatType === 'monthly' ? dayOfMonth : null,
      active_start: repeatType === 'hourly' ? `${activeStart}:00` : null,
      active_end: repeatType === 'hourly' ? `${activeEnd}:00` : null,
      lunch_start: lunchEnabled ? `${lunchStart}:00` : null,
      lunch_end: lunchEnabled ? `${lunchEnd}:00` : null,
    }

    if (repeatType === 'once' && !date) {
      toast.error('Date is required for a one-time reminder')
      return
    }

    try {
      if (isEditing && reminder) {
        await updateReminder.mutateAsync({ id: reminder.id, data: { ...payload, is_active: reminder.is_active } })
        toast.success('Reminder updated')
      } else {
        await createReminder.mutateAsync(payload)
        toast.success('Reminder created')
      }
      onClose()
    } catch (err) {
      toast.error(parseApiError(err))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">{isEditing ? 'Edit Reminder' : 'Add Reminder'}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Reminder Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Drink Water"
              className="input-field"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Repeat</label>
            <select
              value={repeatType}
              onChange={(e) => setRepeatType(e.target.value as RepeatType)}
              className="input-field"
              disabled={saving}
            >
              {REPEAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {repeatType === 'once' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
                disabled={saving}
              />
            </div>
          )}

          {repeatType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Day</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="input-field"
                disabled={saving}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {repeatType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Day of Month</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="input-field"
                disabled={saving}
              />
            </div>
          )}

          {repeatType === 'hourly' ? (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Active Hours</label>
              <p className="text-xs text-text-muted mb-2">
                Fires every hour at the same minute as "From" (e.g. 9:34, 10:34, 11:34...), until "To".
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">From</label>
                  <input
                    type="time"
                    value={activeStart}
                    onChange={(e) => setActiveStart(e.target.value)}
                    className="input-field"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">To</label>
                  <input
                    type="time"
                    value={activeEnd}
                    onChange={(e) => setActiveEnd(e.target.value)}
                    className="input-field"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-field"
                disabled={saving}
              />
            </div>
          )}

          <div className="pt-2 border-t border-border/30 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <input
                type="checkbox"
                checked={lunchEnabled}
                onChange={(e) => setLunchEnabled(e.target.checked)}
                disabled={saving}
                className="accent-primary"
              />
              Skip this reminder during lunch / break time
            </label>

            {lunchEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">From</label>
                  <input
                    type="time"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                    className="input-field"
                    disabled={saving}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">To</label>
                  <input
                    type="time"
                    value={lunchEnd}
                    onChange={(e) => setLunchEnd(e.target.value)}
                    className="input-field"
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary w-full py-2.5 flex items-center justify-center gap-2" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" /> Saving...
              </>
            ) : (
              'Save Reminder'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
