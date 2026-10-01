import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  MessageCircle,
  Mic,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  TimerReset,
  Trash2,
} from 'lucide-react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { useActivities } from '@/hooks/useActivities'
import { useTasks } from '@/hooks/useTasks'
import type { ActivityType, ReminderActivity, Task, TaskStatus } from '@/types/api'

const ACTIVITY_META: Record<ActivityType, { label: string; icon: typeof Plus; tone: string }> = {
  created: { label: 'Created Task', icon: Plus, tone: 'text-success bg-success/10 border-success/20' },
  started: { label: 'Started', icon: Play, tone: 'text-accent bg-accent/10 border-accent/20' },
  working: { label: 'Working', icon: Clock3, tone: 'text-primary bg-primary/10 border-primary/20' },
  updated: { label: 'Updated', icon: Pencil, tone: 'text-warning bg-warning/10 border-warning/20' },
  completed: { label: 'Completed', icon: CheckCircle2, tone: 'text-success bg-success/10 border-success/20' },
  blocked: { label: 'Blocked', icon: AlertTriangle, tone: 'text-danger bg-danger/10 border-danger/20' },
  resumed: { label: 'Resumed', icon: RotateCcw, tone: 'text-accent bg-accent/10 border-accent/20' },
  snoozed: { label: 'Snoozed', icon: TimerReset, tone: 'text-warning bg-warning/10 border-warning/20' },
  deleted: { label: 'Deleted Task', icon: Trash2, tone: 'text-danger bg-danger/10 border-danger/20' },
  reminder_response: { label: 'Reminder Response', icon: MessageCircle, tone: 'text-primary bg-primary/10 border-primary/20' },
  hourly_checkin: { label: 'Check-in', icon: ListChecks, tone: 'text-accent bg-accent/10 border-accent/20' },
  voice_update: { label: 'Voice Update', icon: Mic, tone: 'text-accent bg-accent/10 border-accent/20' },
  text_update: { label: 'Text Update', icon: FileText, tone: 'text-primary bg-primary/10 border-primary/20' },
  companion_action: { label: 'Companion Action', icon: Sparkles, tone: 'text-primary bg-primary/10 border-primary/20' },
  status_update: { label: 'Update', icon: FileText, tone: 'text-text-secondary bg-white/5 border-white/10' },
}

// Where each reminder stands right now (looked up from the live task list).
const STATE_META: Record<TaskStatus | 'deleted', { label: string; tone: string }> = {
  pending: { label: 'Open', tone: 'text-primary bg-primary/10 border-primary/20' },
  in_progress: { label: 'Running now', tone: 'text-accent bg-accent/10 border-accent/20' },
  snoozed: { label: 'Snoozed', tone: 'text-warning bg-warning/10 border-warning/20' },
  blocked: { label: 'Blocked', tone: 'text-danger bg-danger/10 border-danger/20' },
  done: { label: 'Closed', tone: 'text-success bg-success/10 border-success/20' },
  deleted: { label: 'Deleted', tone: 'text-danger bg-danger/10 border-danger/20' },
}

const TASK_ACTIVITIES = new Set<ActivityType>([
  'created', 'started', 'working', 'updated', 'completed', 'blocked', 'resumed', 'snoozed', 'deleted',
])

function displayMeta(activity: ReminderActivity) {
  if (activity.activity_type !== 'hourly_checkin') {
    return ACTIVITY_META[activity.activity_type] ?? ACTIVITY_META.status_update
  }

  const status = activity.metadata?.status
  if (status === 'focused') {
    return {
      label: 'Productive',
      icon: CheckCircle2,
      tone: 'text-success bg-success/10 border-success/20',
    }
  }
  if (status === 'distracted') {
    return {
      label: 'Not productive',
      icon: AlertTriangle,
      tone: 'text-danger bg-danger/10 border-danger/20',
    }
  }
  if (status === 'idle') {
    return {
      label: 'Average',
      icon: Clock3,
      tone: 'text-warning bg-warning/10 border-warning/20',
    }
  }
  if (status === 'missed') {
    return {
      label: 'Missed',
      icon: Clock3,
      tone: 'text-text-muted bg-white/5 border-white/10',
    }
  }

  return ACTIVITY_META.hourly_checkin
}

function TimelineRow({ activity, taskStatus }: { activity: ReminderActivity; taskStatus: Map<string, TaskStatus> }) {
  const meta = displayMeta(activity)
  let state: keyof typeof STATE_META | null = null
  if (TASK_ACTIVITIES.has(activity.activity_type)) {
    state = (activity.task_id && taskStatus.get(activity.task_id)) || 'deleted'
  }
  const Icon = meta.icon
  const timestamp = new Date(activity.timestamp)

  return (
    <div className="grid grid-cols-[4.25rem_2rem_minmax(0,1.1fr)_minmax(0,1fr)] gap-3 px-4 py-3 border-t border-white/[0.06] first:border-t-0 items-start">
      <div className="text-xs leading-tight">
        <div className="font-semibold text-text-primary">{format(timestamp, 'h:mm a')}</div>
        <div className="text-text-muted mt-1">{formatDistanceToNowStrict(timestamp, { addSuffix: true })}</div>
      </div>

      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${meta.tone}`}>
        <Icon size={16} />
      </div>

      <div className="min-w-0">
        <div className="text-sm font-semibold text-text-primary truncate">{meta.label}</div>
        <div className="text-xs text-text-muted capitalize mt-1">{activity.source}</div>
      </div>

      <div className="min-w-0">
        <div className="text-sm text-text-primary truncate">{activity.task_title}</div>
        {state ? (
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATE_META[state].tone}`}>
            Now: {STATE_META[state].label}
          </span>
        ) : null}
        {activity.optional_notes ? (
          <div className="text-xs text-text-secondary mt-1 line-clamp-2">{activity.optional_notes}</div>
        ) : null}
      </div>
    </div>
  )
}

export function TodayTimeline() {
  const { data: allActivities = [], isLoading, error } = useActivities({ today: true, limit: 25 })
  const { data: tasks = [] } = useTasks()
  const taskStatus = new Map<string, TaskStatus>(tasks.map((t: Task) => [t.id, t.status] as [string, TaskStatus]))
  // Show only reminders that are running right now, one row per reminder
  // (the list is newest-first, so the first row seen is its latest activity).
  const seen = new Set<string>()
  const activities = allActivities.filter((a: ReminderActivity) => {
    if (a.task_id === null || taskStatus.get(a.task_id) !== 'in_progress' || seen.has(a.task_id)) return false
    seen.add(a.task_id)
    return true
  })

  return (
    <section className="glass-card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Today's Timeline</h2>
          <p className="text-xs text-text-muted mt-1">{activities.length} running</p>
        </div>
        <Clock3 size={18} className="text-text-muted" />
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-12 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 pb-4 text-sm text-danger">Failed to load today's timeline.</div>
      ) : activities.length === 0 ? (
        <div className="px-4 pb-4 text-sm text-text-secondary">No reminder is running right now.</div>
      ) : (
        <div>
          {activities.map((activity) => (
            <TimelineRow key={activity.id} activity={activity} taskStatus={taskStatus} />
          ))}
        </div>
      )}
    </section>
  )
}
