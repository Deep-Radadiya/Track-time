import { useState } from 'react'
import { format } from 'date-fns'
import { Check, Ellipsis, Pencil, X } from 'lucide-react'
import { useActivities, useUpdateActivity } from '@/hooks/useActivities'
import { useTasks } from '@/hooks/useTasks'
import type { ReminderActivity, Task } from '@/types/api'

const SESSION_BADGE: Record<string, { label: string; icon: typeof Check; bg: string }> = {
  productive: { label: 'Productive', icon: Check, bg: 'bg-green-500' },
  average: { label: 'Average', icon: Ellipsis, bg: 'bg-yellow-400' },
  needs_improvement: { label: 'Needs Improvement', icon: X, bg: 'bg-red-500' },
}

interface UpdatesTableProps {
  /** Show only this task's updates. Omit to show all of today's updates. */
  taskId?: string
  /** "YYYY-MM-DD" to show a past day. Omit for today. */
  date?: string
  /** Only keep updates whose text or task name contains this. */
  search?: string
}

/** Today's updates, grouped by task (one card per task, oldest first). */
export function UpdatesTable({ taskId, date, search }: UpdatesTableProps) {
  const { data: activities = [], isLoading, error } = useActivities(date ? { date, limit: 200 } : { today: true, limit: 200 })
  const { data: tasks = [] } = useTasks()
  const saveUpdate = useUpdateActivity()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const textOf = (a: ReminderActivity) => String(a.metadata?.raw_text ?? a.optional_notes ?? '')
  const startEdit = (a: ReminderActivity) => { setEditingId(a.id); setDraft(textOf(a)) }
  const save = (a: ReminderActivity) => {
    const text = draft.trim()
    if (!text) return
    if (text === textOf(a)) return setEditingId(null)
    saveUpdate.mutate({ id: a.id, text }, { onSuccess: () => setEditingId(null) })
  }
  const titles = new Map<string, string>(tasks.map((t: Task) => [t.id, t.title] as [string, string]))

  const titleOf = (a: ReminderActivity) => (a.task_id && titles.get(a.task_id)) || a.task_title || 'Untitled'

  const rows = activities
    .filter((a: ReminderActivity) => a.metadata?.event === 'reminder_response')
    .filter((a: ReminderActivity) => !taskId || a.task_id === taskId)
    .filter((a: ReminderActivity) => {
      const q = search?.trim().toLowerCase()
      if (!q) return true
      const text = String(a.metadata?.raw_text ?? a.optional_notes ?? '')
      return text.toLowerCase().includes(q) || titleOf(a).toLowerCase().includes(q)
    })
    .sort((a: ReminderActivity, b: ReminderActivity) => +new Date(a.timestamp) - +new Date(b.timestamp))

  const groups = new Map<string, ReminderActivity[]>()
  for (const a of rows) {
    const key = a.task_id ?? titleOf(a)
    groups.set(key, [...(groups.get(key) ?? []), a])
  }

  const rowsView = (list: ReminderActivity[]) => (
    <ul className="divide-y divide-ink/[0.06]">
      {list.map((a, i) => (
        <li key={a.id} className="flex gap-3 px-4 py-2.5 text-sm">
          <span className="w-5 shrink-0 text-text-muted">{i + 1}</span>
          <span className="w-[4.5rem] shrink-0 whitespace-nowrap font-medium text-text-primary">
            {format(new Date(a.timestamp), 'h:mm a')}
          </span>
          {editingId === a.id ? (
            <div className="min-w-0 flex-1 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={2000}
                autoFocus
                className="input-field text-sm"
              />
              <div className="flex gap-2">
                <button onClick={() => save(a)} disabled={saveUpdate.isPending || !draft.trim()} className="btn-primary !min-h-0 py-1.5 px-3 text-xs flex items-center gap-1">
                  <Check size={14} /> Save
                </button>
                <button onClick={() => setEditingId(null)} className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {(() => {
                const badge = SESSION_BADGE[String(a.metadata?.session_status)]
                if (!badge) return null
                const Icon = badge.icon
                return (
                  <span title={badge.label} aria-label={badge.label} className={`shrink-0 self-start w-6 h-6 rounded-full flex items-center justify-center text-white ${badge.bg}`}>
                    <Icon size={15} strokeWidth={2.5} />
                  </span>
                )
              })()}
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-text-primary">
                {textOf(a)}
                {a.metadata?.edited_at ? <span className="ml-2 text-xs text-text-muted">(edited)</span> : null}
              </span>
              <button
                onClick={() => startEdit(a)}
                className="shrink-0 self-start p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-ink/5 transition-all"
                title="Edit update"
                aria-label="Edit update"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  )

  if (isLoading) return <div className="glass-card px-4 py-4 text-sm text-text-secondary">Loading…</div>
  if (error) return <div className="glass-card px-4 py-4 text-sm text-danger">Failed to load updates.</div>
  if (rows.length === 0) {
    return (
      <div className="glass-card px-4 py-4 text-sm text-text-secondary">
        {search || date ? 'No updates found for this day.' : 'No updates yet. When a reminder pops up, click it and write what you did.'}
      </div>
    )
  }

  // One task only (the single-reminder page): a plain list.
  if (taskId) {
    return (
      <section className="glass-card overflow-hidden">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Updates for this task today</h2>
          <p className="text-xs text-text-muted mt-1">{rows.length} {rows.length === 1 ? 'update' : 'updates'}</p>
        </div>
        <div className="border-t border-ink/[0.06]">{rowsView(rows)}</div>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([key, list]) => (
        <section key={key} className="glass-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/5">
            <h2 className="text-sm font-semibold text-text-primary truncate">{titleOf(list[0])}</h2>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {list.length} {list.length === 1 ? 'update' : 'updates'}
            </span>
          </div>
          {rowsView(list)}
        </section>
      ))}
    </div>
  )
}
