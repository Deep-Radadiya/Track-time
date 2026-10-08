import { useState } from 'react'
import { format } from 'date-fns'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Loader2, Check, Ellipsis, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { activitiesApi } from '@/api/activities'
import { ACTIVITIES_KEY } from '@/hooks/useActivities'
import { useTasks } from '@/hooks/useTasks'
import { UpdatesTable } from '@/components/activity/UpdatesTable'
import { parseApiError } from '@/lib/utils'
import type { ReminderActivity, Task } from '@/types/api'

type SessionStatus = 'productive' | 'average' | 'needs_improvement'
const SESSION_STATUSES: { value: SessionStatus; label: string; icon: typeof Check; bg: string }[] = [
  { value: 'productive', label: 'Productive', icon: Check, bg: 'bg-green-500' },
  { value: 'average', label: 'Average', icon: Ellipsis, bg: 'bg-yellow-400' },
  { value: 'needs_improvement', label: 'Needs Improvement', icon: X, bg: 'bg-red-500' },
]

export default function TaskUpdatePage() {
  const { taskId } = useParams<{ taskId: string }>()
  // When opened from a reminder notification, the update is saved at the time that reminder was due.
  const [searchParams] = useSearchParams()
  const reminderTime = searchParams.get('due')
  const { data: tasks = [], isLoading } = useTasks()
  const task = tasks.find((t: Task) => t.id === taskId)
  const [text, setText] = useState('')
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  // The update being edited. It is loaded into this form, so the icon and the description can both be changed.
  const [editing, setEditing] = useState<ReminderActivity | null>(null)
  const qc = useQueryClient()

  const startEdit = (a: ReminderActivity) => {
    setEditing(a)
    setText(String(a.metadata?.raw_text ?? a.optional_notes ?? ''))
    setSessionStatus((a.metadata?.session_status as SessionStatus | undefined) ?? null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelEdit = () => {
    setEditing(null)
    setText('')
    setSessionStatus(null)
  }

  const submit = useMutation({
    mutationFn: () =>
      editing
        ? activitiesApi.update(editing.id, text.trim(), sessionStatus)
        : activitiesApi.submit({ text: text.trim(), source: 'text', task_id: taskId ?? null, session_status: sessionStatus, reminder_time: reminderTime }),
    onSuccess: () => {
      toast.success(editing ? 'Update changed' : 'Update saved')
      setEditing(null)
      setText('')
      setSessionStatus(null)
      qc.invalidateQueries({ queryKey: ACTIVITIES_KEY })
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  })

  const canSubmit = (text.trim().length > 0 || sessionStatus !== null) && !submit.isPending

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
          {isLoading ? 'Loading…' : task ? task.title : 'Reminder not found'}
        </h1>
        {task?.category && <p className="text-sm text-text-secondary mt-1">{task.category}</p>}
      </div>

      {task ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit.mutate() }}
          className="glass-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-semibold text-text-primary">
              {editing ? `Editing the update from ${format(new Date(editing.timestamp), 'h:mm a')}` : 'What did you do since the last update?'}
            </label>
            {editing && (
              <button type="button" onClick={cancelEdit} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
                <X size={14} /> Cancel
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-5 py-1">
            {SESSION_STATUSES.map(({ value, label, icon: Icon, bg }) => {
              const selected = sessionStatus === value
              return (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  disabled={submit.isPending}
                  onClick={() => setSessionStatus(selected ? null : value)}
                  className="flex flex-col items-center gap-1"
                >
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all ${bg} ${selected ? 'ring-2 ring-offset-2 ring-text-primary scale-105' : sessionStatus ? 'opacity-40' : ''}`}>
                    <Icon size={23} strokeWidth={2.5} />
                  </span>
                </button>
              )
            })}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) submit.mutate() }}
            rows={3}
            placeholder="e.g. Finished the login page and fixed the validation bug"
            className="input-field w-full resize-none"
            disabled={submit.isPending}
          />
          <div className="flex justify-end">
            <button type="submit" disabled={!canSubmit} className="btn-primary flex items-center gap-1.5">
              {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {editing ? 'Save changes' : 'Save update'}
            </button>
          </div>
        </form>
      ) : !isLoading ? (
        <p className="text-sm text-text-secondary">This reminder may have been deleted.</p>
      ) : null}

      <UpdatesTable taskId={taskId} onEdit={startEdit} />
    </div>
  )
}
