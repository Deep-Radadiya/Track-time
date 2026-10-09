import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'

// The form shared by the "Create Reminder" and "Edit Reminder" popups.
// Each popup keeps its own state and decides what to send; this file only draws the fields.

// The quick interval buttons. Any other number is typed in with "Custom".
export const INTERVALS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

const CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'Other']

// Times are "HH:MM" strings straight from the <input type="time"> fields.
export interface ReminderFormValues {
  title: string
  start: string
  end: string
  interval: number
  customInterval: boolean
  category: string
  lunchOn: boolean
  lunchStart: string
  lunchEnd: string
}

// Returns the first problem with the form, or null when it can be saved.
// ("HH:MM" strings compare correctly as text, e.g. "09:00" < "18:00".)
export function validateReminderForm(form: ReminderFormValues): string | null {
  if (!form.title.trim()) return 'Please enter what you want to be reminded about.'
  if (form.end <= form.start) return 'End time must be after start time.'
  if (!Number.isInteger(form.interval) || form.interval < 1 || form.interval > 720)
    return 'Enter a reminder interval between 1 and 720 minutes.'
  if (form.lunchOn && form.lunchEnd <= form.lunchStart) return 'Lunch end must be after lunch start.'
  return null
}

// "13:05" -> "1:05 PM"
function to12Hour(time: string) {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

function StepLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px]">{n}</span>
      {children}
    </label>
  )
}

// Style of a selectable "chip" button (interval and category choices).
const chip = (active: boolean) =>
  `px-3.5 py-2 rounded-xl text-sm border transition-all ${
    active
      ? 'bg-primary/20 border-primary text-primary font-semibold'
      : 'border-border text-text-secondary hover:bg-ink/5'
  }`

interface ReminderFormProps {
  form: ReminderFormValues
  setForm: Dispatch<SetStateAction<ReminderFormValues>>
  error: string | null
  busy: boolean
  autoFocusTitle?: boolean
  submitLabel: string
  busyLabel: string
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
}

export function ReminderForm({
  form, setForm, error, busy, autoFocusTitle = false, submitLabel, busyLabel, onSubmit, onCancel,
}: ReminderFormProps) {
  // Changes one field and keeps the others.
  const set = <K extends keyof ReminderFormValues>(key: K, value: ReminderFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  // A plain-English summary of the choices, shown above the buttons.
  const intervalLabel = INTERVALS.find((i) => i.value === form.interval)?.label ?? `${form.interval || '?'} min`
  const summary =
    `Every ${intervalLabel} from ${to12Hour(form.start)} to ${to12Hour(form.end)}` +
    (form.lunchOn ? `, paused for lunch ${to12Hour(form.lunchStart)} – ${to12Hour(form.lunchEnd)}.` : '.')

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <StepLabel n={1}>What should we remind you about?</StepLabel>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Drink water, Check emails, Stretch"
          className="input-field"
          disabled={busy}
          autoFocus={autoFocusTitle}
        />
      </div>

      <div>
        <StepLabel n={2}>When should reminders run each day?</StepLabel>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 mb-3">
          <div>
            <span className="block text-xs text-text-muted mb-1">From</span>
            <input type="time" value={form.start} onChange={(e) => set('start', e.target.value)}
              className="input-field" disabled={busy} />
          </div>
          <div>
            <span className="block text-xs text-text-muted mb-1">To</span>
            <input type="time" value={form.end} onChange={(e) => set('end', e.target.value)}
              className="input-field" disabled={busy} />
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
            {/* An empty box is stored as NaN, so validation can say "enter a number". */}
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
                className="input-field" disabled={busy} />
            </div>
            <div>
              <span className="block text-xs text-text-muted mb-1">Lunch ends</span>
              <input type="time" value={form.lunchEnd} onChange={(e) => set('lunchEnd', e.target.value)}
                className="input-field" disabled={busy} />
            </div>
          </div>
        )}
      </div>

      <p className="text-sm text-text-secondary bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
        {summary}
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Sticky footer: the buttons stay visible while the popup scrolls on small phones. */}
      <div className="flex justify-end gap-3 pt-3 border-t border-border/30 sticky -bottom-4 sm:-bottom-6 bg-bg-surface -mb-4 sm:-mb-6 pb-4 sm:pb-6">
        <button type="button" onClick={onCancel} className="btn-ghost" disabled={busy}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}
