import api from './axios'
import type { Reminder, ReminderCreateRequest, ReminderUpdateRequest } from '@/types/api'

export const remindersApi = {
  list: () => api.get<Reminder[]>('/reminders').then((r) => r.data),

  create: (data: ReminderCreateRequest) =>
    api.post<Reminder>('/reminders', data).then((r) => r.data),

  update: (id: string, data: ReminderUpdateRequest) =>
    api.put<Reminder>(`/reminders/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/reminders/${id}`),
}
