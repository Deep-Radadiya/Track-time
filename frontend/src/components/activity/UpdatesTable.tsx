import { useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Check, Ellipsis, Pencil, Plus, X } from 'lucide-react'
import { useActivities, useMissedReminders, useUpdateActivity } from '@/hooks/useActivities'
import { useTasks } from '@/hooks/useTasks'
import type { MissedReminder, ReminderActivity, Task } from '@/types/api'

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
  /** When given, the pencil hands the update to the page (to edit it in the form above) instead of editing in the row. */
  onEdit?: (update: ReminderActivity) => void
  /** When given, "Add update" on a missed reminder hands it to the page. Otherwise it opens that reminder's update page. */
  onAddMissed?: (missed: MissedReminder) => void
}

type Row = { kind: 'update'; time: number; a: ReminderActivity } | { kind: 'missed'; time: number; m: MissedReminder }

/** Today's updates, grouped by task (one card per task, oldest first). */
export function UpdatesTable({ taskId, date, search, onEdit, onAddMissed }: UpdatesTableProps) {
  const navigate = useNavigate()
  const { data: activities = [], isLoading, error } = useActivities(date ? { date, limit: 200 } : { today: true, limit: 200 })
  const { data: missedAll = [] } = useMissedReminders({ ...(date && { date }), ...(taskId && { task_id: taskId }) })
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

  const addMissed = (m: MissedReminder) =>
    onAddMissed ? onAddMissed(m) : navigate(`/update/${m.task_id}?due=${encodeURIComponent(m.due_at)}`)

  const updateRows: Row[] = activities
    .filter((a: ReminderActivity) => a.metadata?.event === 'reminder_response')
    .filter((a: ReminderActivity) => !taskId || a.task_id === taskId)
    .filter((a: ReminderActivity) => {
      const q = search?.trim().toLowerCase()
      if (!q) return true
      const text = String(a.metadata?.raw_text ?? a.optional_notes ?? '')
      return text.toLowerCase().includes(q) || titleOf(a).toLowerCase().includes(q)
    })
    .map((a: ReminderActivity): Row => ({ kind: 'update', time: +new Date(a.timestamp), a }))

  const q = search?.trim().toLowerCase()
  const missedRows: Row[] = missedAll
    .filter((m: MissedReminder) => !q || (titles.get(m.task_id) ?? m.task_title).toLowerCase().includes(q))
    .map((m: MissedReminder): Row => ({ kind: 'missed', time: +new Date(m.due_at), m }))

  const rows: Row[] = [...updateRows, ...missedRows].sort((x, y) => x.time - y.time)
  const rowTaskId = (row: Row) => (row.kind === 'missed' ? row.m.task_id : row.a.task_id)
  const rowTitle = (row: Row) => (row.kind === 'missed' ? titles.get(row.m.task_id) || row.m.task_title : titleOf(row.a))
  const countUpdates = (list: Row[]) => list.filter((row) => row.kind === 'update').length

  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const key = rowTaskId(row) ?? rowTitle(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const rowsView = (list: Row[]) => (
    <ul className="divide-y divide-ink/[0.06]">
      {list.map((row, i) => {
        if (row.kind === 'missed') {
          const m = row.m
          return (
            <li key={`missed-${m.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-5 shrink-0 text-text-muted">{i + 1}</span>
              <span className="w-[4.5rem] shrink-0 whitespace-nowrap font-medium text-text-muted">
                {format(new Date(m.due_at), 'h:mm a')}
              </span>
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">Missed</span>
              <span className="flex-1" />
              <button onClick={() => addMissed(m)} className="btn-ghost !min-h-0 py-1.5 px-3 text-xs flex items-center gap-1">
                <Plus size={14} /> Add update
              </button>
            </li>
          )
        }
        const a = row.a
        return (
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
                onClick={() => (onEdit ? onEdit(a) : startEdit(a))}
                className="shrink-0 self-start p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-ink/5 transition-all"
                title="Edit update"
                aria-label="Edit update"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </li>
        )
      })}
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
          <p className="text-xs text-text-muted mt-1">{countUpdates(rows)} {countUpdates(rows) === 1 ? 'update' : 'updates'}</p>
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
            <h2 className="text-sm font-semibold text-text-primary truncate">{rowTitle(list[0])}</h2>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {countUpdates(list)} {countUpdates(list) === 1 ? 'update' : 'updates'}
            </span>
          </div>
          {rowsView(list)}
        </section>
      ))}
    </div>
  )
}
