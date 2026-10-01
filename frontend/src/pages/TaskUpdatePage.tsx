import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { activitiesApi } from '@/api/activities'
import { ACTIVITIES_KEY } from '@/hooks/useActivities'
import { useTasks } from '@/hooks/useTasks'
import { UpdatesTable } from '@/components/activity/UpdatesTable'
import { parseApiError } from '@/lib/utils'
import type { Task } from '@/types/api'

export default function TaskUpdatePage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { data: tasks = [], isLoading } = useTasks()
  const task = tasks.find((t: Task) => t.id === taskId)
  const [text, setText] = useState('')
  const qc = useQueryClient()

  const submit = useMutation({
    mutationFn: () => activitiesApi.submit({ text: text.trim(), source: 'text', task_id: taskId ?? null }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ACTIVITIES_KEY })
      toast.success('Update saved')
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  })

  const canSubmit = text.trim().length > 0 && !submit.isPending

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
          <label className="block text-sm font-semibold text-text-primary">What did you do since the last update?</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) submit.mutate() }}
            rows={3}
            autoFocus
            placeholder="e.g. Finished the login page and fixed the validation bug"
            className="input-field w-full resize-none"
            disabled={submit.isPending}
          />
          <div className="flex justify-end">
            <button type="submit" disabled={!canSubmit} className="btn-primary flex items-center gap-1.5">
              {submit.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Save update
            </button>
          </div>
        </form>
      ) : !isLoading ? (
        <p className="text-sm text-text-secondary">This reminder may have been deleted.</p>
      ) : null}

      <UpdatesTable taskId={taskId} />
    </div>
  )
}
