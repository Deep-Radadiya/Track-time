import { format } from 'date-fns'
import { useActivities } from '@/hooks/useActivities'
import { useTasks } from '@/hooks/useTasks'
import type { ReminderActivity, Task } from '@/types/api'

interface UpdatesTableProps {
  /** Show only this task's updates. Omit to show all of today's updates. */
  taskId?: string
}

/** Numbered, chronological table of the updates the user wrote today. */
export function UpdatesTable({ taskId }: UpdatesTableProps) {
  const { data: activities = [], isLoading, error } = useActivities({ today: true, limit: 200 })
  const { data: tasks = [] } = useTasks()
  const titles = new Map<string, string>(tasks.map((t: Task) => [t.id, t.title] as [string, string]))

  const rows = activities
    .filter((a: ReminderActivity) => a.metadata?.event === 'reminder_response')
    .filter((a: ReminderActivity) => !taskId || a.task_id === taskId)
    .sort((a: ReminderActivity, b: ReminderActivity) => +new Date(a.timestamp) - +new Date(b.timestamp))

  return (
    <section className="glass-card overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">
          {taskId ? 'Updates for this task today' : "Today's Updates"}
        </h2>
        <p className="text-xs text-text-muted mt-1">{rows.length} {rows.length === 1 ? 'update' : 'updates'}</p>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 text-sm text-text-secondary">Loading…</div>
      ) : error ? (
        <div className="px-4 pb-4 text-sm text-danger">Failed to load updates.</div>
      ) : rows.length === 0 ? (
        <div className="px-4 pb-4 text-sm text-text-secondary">
          No updates yet. When a reminder pops up, click it and write what you did.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-text-muted border-t border-white/[0.06]">
                <th className="px-4 py-2 w-10">#</th>
                <th className="px-4 py-2 w-28 whitespace-nowrap">Time</th>
                {!taskId && <th className="px-4 py-2 w-48">Task</th>}
                <th className="px-4 py-2">Update</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a: ReminderActivity, i: number) => (
                <tr key={a.id} className="border-t border-white/[0.06] align-top">
                  <td className="px-4 py-2 text-text-muted">{i + 1}</td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-text-primary">
                    {format(new Date(a.timestamp), 'h:mm a')}
                  </td>
                  {!taskId && (
                    <td className="px-4 py-2 text-text-secondary">
                      {(a.task_id && titles.get(a.task_id)) || a.task_title}
                    </td>
                  )}
                  <td className="px-4 py-2 text-text-primary whitespace-pre-wrap break-words">
                    {String(a.metadata?.raw_text ?? a.optional_notes ?? '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
