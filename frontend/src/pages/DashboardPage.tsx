import { useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useAuthStore } from '@/stores/authStore'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskCreateModal } from '@/components/tasks/TaskCreateModal'
import { Plus } from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const { data: tasks = [], isLoading, error } = useTasks()
  const { user } = useAuthStore()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl brand-gradient p-5 sm:p-7 text-white shadow-glow select-none">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10" />
        <div className="absolute right-16 -bottom-14 w-36 h-36 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-white/80">{greeting()}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight capitalize">
              {user?.email.split('@')[0]}
            </h1>
            <p className="text-sm text-white/80 mt-1">Here is your schedule for today.</p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-white text-primary-dark font-semibold px-5 min-h-[44px] shadow-lg active:scale-[0.97] hover:bg-white/90 transition-all"
          >
            <Plus size={18} /> New Reminder
          </button>
        </div>
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
