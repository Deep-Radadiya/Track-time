import { useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskCreateModal } from '@/components/tasks/TaskCreateModal'
import { Plus } from 'lucide-react'

export default function DashboardPage() {
  const { data: tasks = [], isLoading, error } = useTasks()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex sm:justify-end select-none">
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
          <Plus size={18} /> New Reminder
        </button>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-ink/10 rounded-md w-3/4" />
                <div className="h-3 bg-ink/10 rounded-md w-1/2" />
                <div className="h-8 bg-ink/10 rounded-md w-full mt-2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl border border-danger/20 bg-danger/5 text-danger text-sm flex items-center gap-2">
            Failed to load tasks. Please check your network connection.
          </div>
        ) : (
          <TaskList tasks={tasks} />
        )}
      </div>

      <TaskCreateModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  )
}
