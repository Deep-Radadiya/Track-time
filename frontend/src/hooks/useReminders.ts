import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { remindersApi } from '@/api/reminders'
import type { ReminderCreateRequest, ReminderUpdateRequest } from '@/types/api'

export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: remindersApi.list,
  })
}

export function useCreateReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ReminderCreateRequest) => remindersApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  })
}

export function useUpdateReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReminderUpdateRequest }) => remindersApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  })
}

export function useDeleteReminder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => remindersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  })
}
