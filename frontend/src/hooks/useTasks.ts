import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { tasksApi } from '@/api/tasks'
import { ACTIVITIES_KEY } from '@/hooks/useActivities'
import type { Task, TaskCreateRequest, TaskUpdateRequest, TaskActionRequest } from '@/types/api'
import toast from 'react-hot-toast'
import { parseApiError } from '@/lib/utils'

export const TASKS_KEY = ['tasks'] as const

// Any change to a reminder also writes to the activity log, so both lists are loaded again.
function reloadTasksAndUpdates(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: TASKS_KEY })
  qc.invalidateQueries({ queryKey: ACTIVITIES_KEY })
}

// The text shown after each quick action on a reminder.
const ACTION_MESSAGES: Record<string, string> = {
  done: '✓ Marked as done',
  start: '▶ Started',
  block: '⛔ Blocked',
  reopen: '↩ Reopened',
  snooze: '⏰ Snoozed',
}

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: TASKS_KEY,
    queryFn: () => tasksApi.list(0, 100),
    staleTime: 30_000,
    refetchInterval: 30_000, // fallback in case a live update is missed
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TaskCreateRequest) => tasksApi.create(data),
    onSuccess: () => {
      reloadTasksAndUpdates(qc)
      toast.success('Task created!')
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdateRequest }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      reloadTasksAndUpdates(qc)
      toast.success('Task updated!')
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      reloadTasksAndUpdates(qc)
      toast.success('Task deleted')
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  })
}

// Quick actions: done, start, block, reopen, snooze.
export function useTaskAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskActionRequest }) =>
      tasksApi.action(id, data),
    onSuccess: (_task, variables) => {
      reloadTasksAndUpdates(qc)
      toast.success(ACTION_MESSAGES[variables.data.action] ?? 'Action applied')
    },
    onError: (err: unknown) => toast.error(parseApiError(err)),
  })
}
