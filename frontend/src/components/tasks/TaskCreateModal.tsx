import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useCreateTask } from '@/hooks/useTasks'

interface TaskCreateModalProps {
  open: boolean
  onClose: () => void
}

const INTERVALS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

const CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'Other']

const DEFAULTS = {
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

function fmt(t: string) {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px]">{n}</span>
      {children}
    </label>
  )
}

export function TaskCreateModal({ open, onClose }: TaskCreateModalProps) {
  const createMutation = useCreateTask()
  const [form, setForm] = useState(DEFAULTS)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const close = () => {
    setForm(DEFAULTS)
    setError(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Please enter what you want to be reminded about.')
    if (form.end <= form.start) return setError('End time must be after start time.')
    if (!Number.isInteger(form.interval) || form.interval < 1 || form.interval > 720)
      return setError('Enter a reminder interval between 1 and 720 minutes.')
    if (form.lunchOn) {
      if (form.lunchEnd <= form.lunchStart) return setError('Lunch end must be after lunch start.')
    }
    setError(null)

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

  const busy = createMutation.isPending
  const intervalLabel = INTERVALS.find((i) => i.value === form.interval)?.label ?? `${form.interval || '?'} min`
  const summary =
    `Every ${intervalLabel} from ${fmt(form.start)} to ${fmt(form.end)}` +
    (form.lunchOn ? `, paused for lunch ${fmt(form.lunchStart)} – ${fmt(form.lunchEnd)}.` : '.')

  const chip = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-sm border transition-all ${
      active
        ? 'bg-primary/20 border-primary text-primary font-semibold'
        : 'border-border text-text-secondary hover:bg-ink/5'
    }`

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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <StepLabel n={1}>What should we remind you about?</StepLabel>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Drink water, Check emails, Stretch"
                className="input-field"
                disabled={busy}
                autoFocus
              />
            </div>

            <div>
              <StepLabel n={2}>When should reminders run each day?</StepLabel>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 mb-3">
                <div>
                  <span className="block text-xs text-text-muted mb-1">From</span>
                  <input type="time" value={form.start} onChange={(e) => set('start', e.target.value)}
                    className="input-field " disabled={busy} />
                </div>
                <div>
                  <span className="block text-xs text-text-muted mb-1">To</span>
                  <input type="time" value={form.end} onChange={(e) => set('end', e.target.value)}
                    className="input-field " disabled={busy} />
                </div>
              </div>
              <span className="block text-xs text-text-muted mb-1">Remind me every</span>
              <div className="flex flex-wrap gap-2">
                {INTERVALS.map((i) => (
                  <button key={i.value} type="button" disabled={busy}
                    onClick={() => setForm((f) => ({ ...f, interval: i.value, customInterval: false }))}
                    className={chip(!form.customInterval && form.interval === i.value)}>
                    {i.label}
                  </button>
                ))}
                <button type="button" disabled={busy}
                  onClick={() => set('customInterval', true)} className={chip(form.customInterval)}>
                  Custom
                </button>
              </div>
              {form.customInterval && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={Number.isNaN(form.interval) ? '' : form.interval}
                    onChange={(e) => set('interval', e.target.value === '' ? NaN : Number(e.target.value))}
                    className="input-field w-28"
                    placeholder="e.g. 45"
                    disabled={busy}
                  />
                  <span className="text-sm text-text-secondary">minutes</span>
                </div>
              )}
            </div>

            <div>
              <StepLabel n={3}>Category</StepLabel>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" disabled={busy}
                    onClick={() => set('category', c)} className={chip(form.category === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <StepLabel n={4}>Lunch break</StepLabel>
              <label className="flex items-center gap-2 text-sm text-text-secondary mb-2 cursor-pointer">
                <input type="checkbox" checked={form.lunchOn} onChange={(e) => set('lunchOn', e.target.checked)}
                  disabled={busy} className="accent-primary" />
                Don&apos;t remind me during lunch
              </label>
              {form.lunchOn && (
                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <span className="block text-xs text-text-muted mb-1">Lunch starts</span>
                    <input type="time" value={form.lunchStart} onChange={(e) => set('lunchStart', e.target.value)}
                      className="input-field " disabled={busy} />
                  </div>
                  <div>
                    <span className="block text-xs text-text-muted mb-1">Lunch ends</span>
                    <input type="time" value={form.lunchEnd} onChange={(e) => set('lunchEnd', e.target.value)}
                      className="input-field " disabled={busy} />
                  </div>
                </div>
              )}
            </div>

            <p className="text-sm text-text-secondary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              {summary}
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex justify-end gap-3 pt-3 border-t border-border/30 sticky -bottom-4 sm:-bottom-6 bg-bg-surface -mb-4 sm:-mb-6 pb-4 sm:pb-6">
              <button type="button" onClick={close} className="btn-ghost" disabled={busy}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
