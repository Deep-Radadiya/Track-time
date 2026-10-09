import { useState } from 'react'
import type { Task } from '@/types/api'
import { TaskCard } from './TaskCard'
import { AlertCircle, ArrowUpRight } from 'lucide-react'
import { TaskCreateModal } from './TaskCreateModal'
import { isReminderOn } from '@/lib/utils'

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Reminders that are ON first, paused (OFF) ones last.
  const sorted = [...tasks.filter(isReminderOn), ...tasks.filter((t) => !isReminderOn(t))]

  const totalCount = tasks.length
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border/50 rounded-2xl bg-ink/[0.01]">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary animate-pulse-slow">
          <AlertCircle size={28} />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">No reminders yet</h3>
        <p className="text-sm text-text-secondary mt-1 max-w-sm">
          Get started by adding a task or using Voice Input to transcribe your reminders automatically.
        </p>
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary mt-6 flex items-center gap-2">
          Create Reminder <ArrowUpRight size={16} />
        </button>
        <TaskCreateModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none">
      {sorted.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}
