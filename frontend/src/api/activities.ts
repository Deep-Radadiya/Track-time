import api from './axios'
import type { ActivityListParams, ActivitySubmitRequest, ReminderActivity } from '@/types/api'

export const activitiesApi = {
  list: (params: ActivityListParams = {}): Promise<ReminderActivity[]> =>
    api.get<ReminderActivity[]>('/activities', { params }).then((r) => r.data),

  submit: (data: ActivitySubmitRequest): Promise<ReminderActivity> =>
    api.post<ReminderActivity>('/activities/submit', data).then((r) => r.data),

  update: (id: string, text: string): Promise<ReminderActivity> =>
    api.patch<ReminderActivity>(`/activities/${id}`, { text }).then((r) => r.data),
}
