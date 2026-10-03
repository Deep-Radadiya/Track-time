import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { activitiesApi } from '@/api/activities'
import type { ActivityListParams, ReminderActivity } from '@/types/api'

export const ACTIVITIES_KEY = ['activities'] as const

export function useActivities(params: ActivityListParams = {}) {
  return useQuery<ReminderActivity[]>({
    queryKey: [...ACTIVITIES_KEY, params],
    queryFn: () => activitiesApi.list(params),
    staleTime: 15_000,
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => activitiesApi.update(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVITIES_KEY })
      toast.success('Update saved')
    },
    onError: () => toast.error('Could not save the update'),
  })
}
