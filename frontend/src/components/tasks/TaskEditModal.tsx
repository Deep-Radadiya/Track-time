import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useUpdateTask } from '@/hooks/useTasks'
import type { Task } from '@/types/api'
import { INTERVALS, ReminderForm, validateReminderForm, type ReminderFormValues } from './ReminderForm'

interface TaskEditModalProps {
  open: boolean
  onClose: () => void
  task: Task
}

// The server stores "HH:MM:SS"; the time inputs want "HH:MM".
const hhmm = (t: string | null | undefined, fallback: string) => (t ? t.slice(0, 5) : fallback)

// Fills the form with the reminder's saved values.
function formFromTask(task: Task): ReminderFormValues {
  const interval = task.interval_minutes ?? 60
  return {
    title: task.title,
    start: hhmm(task.window_start, '09:00'),
    end: hhmm(task.window_end, '18:00'),
    interval,
    customInterval: !INTERVALS.some((i) => i.value === interval),
    category: task.category || 'Work',
    lunchOn: !!task.lunch_start,
    lunchStart: hhmm(task.lunch_start, '13:00'),
    lunchEnd: hhmm(task.lunch_end, '14:00'),
  }
}

export function TaskEditModal({ open, onClose, task }: TaskEditModalProps) {
  const updateMutation = useUpdateTask()
  const [form, setForm] = useState(() => formFromTask(task))
  const [error, setError] = useState<string | null>(null)

  // Start from the saved values every time the popup opens.
  useEffect(() => {
    if (open) {
      setForm(formFromTask(task))
      setError(null)
    }
  }, [open, task])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateReminderForm(form)
    setError(problem)
    if (problem) return

    updateMutation.mutate(
      {
        id: task.id,
        data: {
          title: form.title.trim(),
          interval_minutes: form.interval,
          window_start: form.start,
          window_end: form.end,
          lunch_start: form.lunchOn ? form.lunchStart : null,
          lunch_end: form.lunchOn ? form.lunchEnd : null,
          category: form.category,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-bg-surface border border-border p-4 sm:p-6 shadow-2xl animate-fade-in focus:outline-none max-h-[88dvh] overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
            <Dialog.Title className="text-lg font-bold text-text-primary">Edit Reminder</Dialog.Title>
            <Dialog.Close className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-ink/5 transition-all">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Change what to be reminded about, the daily time range, how often, a category and a lunch break.
          </Dialog.Description>

          <ReminderForm
            form={form}
            setForm={setForm}
            error={error}
            busy={updateMutation.isPending}
            submitLabel="Save Changes"
            busyLabel="Saving..."
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
