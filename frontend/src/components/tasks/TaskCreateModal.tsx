import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useCreateTask } from '@/hooks/useTasks'
import { ReminderForm, validateReminderForm, type ReminderFormValues } from './ReminderForm'

interface TaskCreateModalProps {
  open: boolean
  onClose: () => void
}

// What a new reminder starts with: every hour, 9 AM to 6 PM, with a 1 PM lunch break.
const DEFAULTS: ReminderFormValues = {
  title: '',
  start: '09:00',
  end: '18:00',
  interval: 60,
  customInterval: false,
  category: 'Work',
  lunchOn: true,
  lunchStart: '13:00',
  lunchEnd: '14:00',
}

export function TaskCreateModal({ open, onClose }: TaskCreateModalProps) {
  const createMutation = useCreateTask()
  const [form, setForm] = useState(DEFAULTS)
  const [error, setError] = useState<string | null>(null)

  // Closing always clears the form, so the next "New Reminder" starts empty.
  const close = () => {
    setForm(DEFAULTS)
    setError(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateReminderForm(form)
    setError(problem)
    if (problem) return

    // Every reminder made here repeats inside a daily time window.
    createMutation.mutate(
      {
        title: form.title.trim(),
        recurrence: 'interval',
        interval_minutes: form.interval,
        window_start: form.start,
        window_end: form.end,
        lunch_start: form.lunchOn ? form.lunchStart : null,
        lunch_end: form.lunchOn ? form.lunchEnd : null,
        category: form.category,
        source: 'text' as const,
        notes: [],
      },
      { onSuccess: close },
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o: boolean) => { if (!o) close() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-bg-surface border border-border p-4 sm:p-6 shadow-2xl animate-fade-in focus:outline-none max-h-[88dvh] overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
            <Dialog.Title className="text-lg font-bold text-text-primary">Create Reminder</Dialog.Title>
            <Dialog.Close className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-ink/5 transition-all">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Set what to be reminded about, the daily time range, how often, a category and a lunch break.
          </Dialog.Description>

          <ReminderForm
            form={form}
            setForm={setForm}
            error={error}
            busy={createMutation.isPending}
            autoFocusTitle
            submitLabel="Create"
            busyLabel="Creating..."
            onSubmit={handleSubmit}
            onCancel={close}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
